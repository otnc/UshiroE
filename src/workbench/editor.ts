import fs from "node:fs";
import path from "node:path";

import { type ElevatedWriter, type FileChange, applyChanges, writeFileAtomic } from "./fileio";
import { IntegrityError, type IntegrityResult, checkIntegrity } from "./integrity";
import { lockPathFor, withLock } from "./lock";
import {
  assertOnlyChecksumChanged,
  inspectPatch,
  readChecksum,
  replaceChecksum,
  stripBackImage,
  stripUshiroe,
  vscodeChecksum,
} from "./patch";
import { WORKBENCH_SCRIPT_KEY, type WorkbenchPaths, workbenchPaths } from "./paths";

const ORIGINALS_FILE = "workbench-originals.json";

export interface EditorOptions {
  appRoot: string;
  /** UshiroE's own folder for the recorded checksums and backups (its global storage). */
  stateDir: string;
  /** Where the cross-window lock lives; defaults to the OS temp folder. */
  lockDir?: string;
  /** Writes files that need administrator rights; without it such writes fail. */
  elevate?: ElevatedWriter;
  /** Smallest plausible script size; tests use tiny fixtures. */
  minBytes?: number;
}

export interface WorkbenchSnapshot {
  script: string;
  scriptBytes: Buffer;
  product: string | null;
  commit: string | null;
  productChecksum: string | null;
}

export interface WorkbenchStatus {
  /** VS Code's build commit from product.json. */
  commit: string | null;
  /** Hash of the UshiroE block in the script, or null. */
  blockHash: string | null;
  hasBackImage: boolean;
  integrity: IntegrityResult;
}

export type RestoreResult = "backup" | "removed" | "nothing";

function decode(bytes: Buffer, file: string): string {
  const text = bytes.toString("utf8");
  // Edits must keep every other byte as it was, which only holds for valid UTF-8.
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    throw new Error(`${file} is not valid UTF-8; refusing to edit it.`);
  }
  return text;
}

/**
 * Every change UshiroE makes to VS Code's installation goes through here: under a lock shared
 * by all windows, after re-reading the files, only on a known-good base, and atomically.
 */
export class WorkbenchEditor {
  readonly paths: WorkbenchPaths;
  readonly lockPath: string;

  constructor(private readonly options: EditorOptions) {
    this.paths = workbenchPaths(options.appRoot);
    this.lockPath = lockPathFor(options.appRoot, options.lockDir);
  }

  async read(): Promise<WorkbenchSnapshot> {
    const scriptBytes = await fs.promises.readFile(this.paths.script);
    const productBytes = await fs.promises.readFile(this.paths.product).catch(() => null);
    const product = productBytes === null ? null : decode(productBytes, this.paths.product);
    let commit: string | null;
    try {
      commit =
        product === null
          ? null
          : ((JSON.parse(product.replace(/^\uFEFF/, "")) as { commit?: string }).commit ?? null);
    } catch {
      commit = null;
    }
    return {
      script: decode(scriptBytes, this.paths.script),
      scriptBytes,
      product,
      commit,
      productChecksum: product === null ? null : readChecksum(product, WORKBENCH_SCRIPT_KEY),
    };
  }

  private originalsFile(): string {
    return path.join(this.options.stateDir, ORIGINALS_FILE);
  }

  backupFile(commit: string): string {
    return path.join(this.options.stateDir, "backup", `${commit.replace(/[^0-9a-zA-Z]/g, "")}.js`);
  }

  recordedOriginal(commit: string | null): string | null {
    if (commit === null) {
      return null;
    }
    try {
      const data = JSON.parse(fs.readFileSync(this.originalsFile(), "utf8")) as Record<
        string,
        { originalChecksum?: string }
      >;
      return data[commit]?.originalChecksum ?? null;
    } catch {
      return null;
    }
  }

  /** Remembers VS Code's own checksum and a copy of the pristine script, once per commit. */
  private async recordOriginal(commit: string, checksum: string, base: string): Promise<void> {
    if (this.recordedOriginal(commit) !== null) {
      return;
    }
    await fs.promises.mkdir(path.dirname(this.backupFile(commit)), { recursive: true });
    await writeFileAtomic(this.backupFile(commit), Buffer.from(base, "utf8"));
    let data: Record<string, { originalChecksum: string }>;
    try {
      data = JSON.parse(await fs.promises.readFile(this.originalsFile(), "utf8"));
    } catch {
      data = {};
    }
    data[commit] = { originalChecksum: checksum };
    await writeFileAtomic(this.originalsFile(), Buffer.from(JSON.stringify(data, null, 2), "utf8"));
  }

  private check(snapshot: WorkbenchSnapshot): IntegrityResult {
    return checkIntegrity({
      script: snapshot.script,
      productChecksum: snapshot.productChecksum,
      recordedOriginal: this.recordedOriginal(snapshot.commit),
      minBytes: this.options.minBytes,
    });
  }

  async status(): Promise<WorkbenchStatus> {
    const snapshot = await this.read();
    const info = inspectPatch(snapshot.script);
    return {
      commit: snapshot.commit,
      blockHash: info.hash,
      hasBackImage: info.hasBackImage,
      integrity: this.check(snapshot),
    };
  }

  existingBackImageBackups(): string[] {
    return this.paths.backImageBackups.filter((file) => fs.existsSync(file));
  }

  /** Builds the script and checksum changes; only the one checksum value may differ. */
  private changesFor(
    snapshot: WorkbenchSnapshot,
    script: string,
    checksum: string,
    extra: FileChange[] = []
  ): FileChange[] {
    const changes: FileChange[] = [];
    if (script !== snapshot.script) {
      changes.push({ target: this.paths.script, content: Buffer.from(script, "utf8") });
    }
    if (snapshot.product !== null) {
      const product = replaceChecksum(snapshot.product, WORKBENCH_SCRIPT_KEY, checksum);
      if (product !== null && product !== snapshot.product) {
        assertOnlyChecksumChanged(snapshot.product, product, WORKBENCH_SCRIPT_KEY);
        changes.push({ target: this.paths.product, content: Buffer.from(product, "utf8") });
      }
    }
    return [...changes, ...extra];
  }

  /** Reads, checks and writes under the lock, so nothing read earlier is ever reused. */
  private locked<T>(
    task: (snapshot: WorkbenchSnapshot, good: IntegrityResult & { ok: true }) => Promise<T>
  ): Promise<T> {
    return withLock(this.lockPath, async () => {
      const snapshot = await this.read();
      const integrity = this.check(snapshot);
      if (!integrity.ok) {
        throw new IntegrityError(integrity.reason);
      }
      return task(snapshot, integrity);
    });
  }

  /** The checksum VS Code shipped with: the recorded one, or the checksum of the clean base. */
  private original(snapshot: WorkbenchSnapshot, good: IntegrityResult & { ok: true }): string {
    return this.recordedOriginal(snapshot.commit) ?? good.baseChecksum;
  }

  /**
   * Installs `block` in place of any UshiroE or BackImage block. Returns whether the script
   * changed. With `hideCorruptWarning` the checksum covers the patched script; otherwise it
   * stays VS Code's own.
   */
  apply(block: string, hideCorruptWarning: boolean): Promise<boolean> {
    return this.locked(async (snapshot, good) => {
      if (
        good.basePristine &&
        snapshot.commit !== null &&
        good.baseChecksum === snapshot.productChecksum
      ) {
        await this.recordOriginal(snapshot.commit, good.baseChecksum, good.base);
      }
      const patched = good.base + block;
      const checksum = hideCorruptWarning ? vscodeChecksum(patched) : this.original(snapshot, good);
      const changes = this.changesFor(snapshot, patched, checksum);
      await applyChanges(changes, this.options.elevate);
      return patched !== snapshot.script;
    });
  }

  /** Removes the UshiroE block and puts VS Code's checksum back. Returns whether a block was there. */
  remove(): Promise<boolean> {
    return this.locked(async (snapshot, good) => {
      const restored = stripUshiroe(snapshot.script);
      await applyChanges(
        this.changesFor(snapshot, restored, this.original(snapshot, good)),
        this.options.elevate
      );
      return restored !== snapshot.script;
    });
  }

  /** Deletes BackImage's block and backups. Only safe once BackImage is no longer running. */
  removeBackImageLeftovers(hideCorruptWarning: boolean): Promise<void> {
    return this.locked(async (snapshot, good) => {
      const cleaned = stripBackImage(snapshot.script);
      const hasOwnBlock = cleaned !== stripUshiroe(cleaned);
      const checksum =
        hasOwnBlock && hideCorruptWarning ? vscodeChecksum(cleaned) : this.original(snapshot, good);
      const deletions = this.existingBackImageBackups().map((target) => ({
        target,
        content: null,
      }));
      await applyChanges(
        this.changesFor(snapshot, cleaned, checksum, deletions),
        this.options.elevate
      );
    });
  }

  /**
   * Puts VS Code's workbench back: from the saved pristine copy when its hash matches the
   * recorded original, otherwise by removing UshiroE's block.
   */
  restore(): Promise<RestoreResult> {
    return withLock(this.lockPath, async () => {
      const snapshot = await this.read();
      const original = this.recordedOriginal(snapshot.commit);
      if (snapshot.commit !== null && original !== null) {
        const backup = await fs.promises
          .readFile(this.backupFile(snapshot.commit))
          .catch(() => null);
        if (backup !== null && vscodeChecksum(backup) === original) {
          const text = decode(backup, this.backupFile(snapshot.commit));
          const changes = this.changesFor(snapshot, text, original);
          await applyChanges(changes, this.options.elevate);
          return changes.length > 0 ? "backup" : "nothing";
        }
      }
      const integrity = this.check(snapshot);
      if (!integrity.ok) {
        throw new IntegrityError(integrity.reason);
      }
      const restored = stripUshiroe(snapshot.script);
      const changes = this.changesFor(snapshot, restored, original ?? integrity.baseChecksum);
      await applyChanges(changes, this.options.elevate);
      return changes.length > 0 ? "removed" : "nothing";
    });
  }
}
