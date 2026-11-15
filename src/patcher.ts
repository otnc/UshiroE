import fs from "node:fs";

import { env, l10n, window } from "vscode";

import type { RuntimeBoot } from "./runtime/main";
import { type FileChange, applyChangesDirect, applyChangesElevated } from "./workbench/fileio";
import {
  applyPatch,
  buildPatchBlock,
  inspectPatch,
  replaceChecksum,
  stripBackImage,
  stripUshiroe,
  vscodeChecksum,
} from "./workbench/patch";
import { WORKBENCH_SCRIPT_KEY, type WorkbenchPaths, workbenchPaths } from "./workbench/paths";

export type PatchState = "applied" | "outdated" | "missing";

export interface PatchStatus {
  state: PatchState;
  /** BackImage's own patch is still in the workbench script. */
  hasBackImage: boolean;
}

export class CancelledError extends Error {
  constructor() {
    super("Cancelled by the user");
    this.name = "CancelledError";
  }
}

export class Patcher {
  readonly paths: WorkbenchPaths = workbenchPaths(env.appRoot);
  private expected: { block: string; hash: string } | undefined;

  constructor(
    private readonly runtimeFile: string,
    private readonly boot: RuntimeBoot
  ) {}

  private async expectedBlock(): Promise<{ block: string; hash: string }> {
    this.expected ??= buildPatchBlock(
      await fs.promises.readFile(this.runtimeFile, "utf8"),
      this.boot
    );
    return this.expected;
  }

  private readScript(): Promise<string> {
    return fs.promises.readFile(this.paths.script, "utf8");
  }

  async status(): Promise<PatchStatus> {
    const [{ hash }, info] = await Promise.all([
      this.expectedBlock(),
      this.readScript().then(inspectPatch),
    ]);
    const state: PatchState =
      info.hash === null ? "missing" : info.hash === hash ? "applied" : "outdated";
    return { state, hasBackImage: info.hasBackImage };
  }

  /** Installs or updates the patch. Returns false when the script was already current. */
  async apply(hideCorruptWarning: boolean): Promise<boolean> {
    const { block } = await this.expectedBlock();
    const current = await this.readScript();
    const original = stripBackImage(stripUshiroe(current));
    const patched = applyPatch(current, block);
    const changes: FileChange[] = [];
    if (patched !== current) {
      changes.push({ target: this.paths.script, content: patched });
    }
    // Matching the checksum to the patched file hides the "installation appears to be corrupt"
    // notice; matching it to the original keeps VS Code's own check meaningful.
    const product = await this.productChange(hideCorruptWarning ? patched : original);
    if (product) {
      changes.push(product);
    }
    await this.commit(changes);
    return patched !== current;
  }

  /** Removes the UshiroE patch and restores the checksum. Returns false when nothing was installed. */
  async remove(): Promise<boolean> {
    const current = await this.readScript();
    const restored = stripUshiroe(current);
    const changes: FileChange[] = [];
    if (restored !== current) {
      changes.push({ target: this.paths.script, content: restored });
    }
    const product = await this.productChange(restored);
    if (product) {
      changes.push(product);
    }
    await this.commit(changes);
    return restored !== current;
  }

  existingBackImageBackups(): string[] {
    return this.paths.backImageBackups.filter((file) => fs.existsSync(file));
  }

  /** Deletes BackImage's patch and backup files. Only safe once BackImage is uninstalled. */
  async removeBackImageLeftovers(): Promise<void> {
    const current = await this.readScript();
    const cleaned = stripBackImage(current);
    const changes: FileChange[] = this.existingBackImageBackups().map((target) => ({
      target,
      content: null,
    }));
    if (cleaned !== current) {
      changes.push({ target: this.paths.script, content: cleaned });
      const product = await this.productChange(cleaned);
      if (product) {
        changes.push(product);
      }
    }
    await this.commit(changes);
  }

  private async productChange(script: string): Promise<FileChange | null> {
    let product: string;
    try {
      product = await fs.promises.readFile(this.paths.product, "utf8");
    } catch {
      return null;
    }
    const updated = replaceChecksum(product, WORKBENCH_SCRIPT_KEY, vscodeChecksum(script));
    return updated === null || updated === product
      ? null
      : { target: this.paths.product, content: updated };
  }

  private async commit(changes: FileChange[]): Promise<void> {
    const denied = await applyChangesDirect(changes);
    if (denied.length === 0) {
      return;
    }
    const retry = l10n.t("Retry as Administrator");
    const choice = await window.showWarningMessage(
      l10n.t("UshiroE needs administrator rights to modify VS Code's installation folder."),
      { modal: true, detail: denied.map((change) => change.target).join("\n") },
      retry
    );
    if (choice !== retry) {
      throw new CancelledError();
    }
    await applyChangesElevated(denied);
  }
}
