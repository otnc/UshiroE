import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as sudo from "@vscode/sudo-prompt";

export class PermissionError extends Error {
  constructor(
    public readonly target: string,
    cause: unknown
  ) {
    super(`No permission to write ${target}`, { cause });
    this.name = "PermissionError";
  }
}

export class VerificationError extends Error {
  constructor(public readonly target: string) {
    super(`${target} did not contain what was written; the previous content was put back.`);
    this.name = "VerificationError";
  }
}

export interface FileChange {
  target: string;
  /** New content, or null to delete the file. */
  content: Buffer | null;
}

/**
 * Writes the changes that need administrator rights. Resolves false when the user declined.
 * Each change must be staged next to its target and moved over it, never copied onto it.
 */
export type ElevatedWriter = (changes: FileChange[]) => Promise<boolean>;

export class CancelledError extends Error {
  constructor() {
    super("Cancelled by the user");
    this.name = "CancelledError";
  }
}

const RETRYABLE = new Set(["EPERM", "EBUSY", "EACCES"]);
const PERMISSION = new Set(["EACCES", "EPERM", "EROFS"]);

function code(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

function sha256(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/** A temp name in the target's own folder, so the final rename never crosses volumes. */
export function tempPathFor(target: string): string {
  return `${target}.ushiroe-${randomBytes(6).toString("hex")}.tmp`;
}

async function renameWithRetry(from: string, to: string): Promise<void> {
  // Windows refuses to replace a file that a virus scanner or VS Code briefly holds open.
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.promises.rename(from, to);
      return;
    } catch (error) {
      if (process.platform !== "win32" || !RETRYABLE.has(code(error) ?? "") || attempt >= 5) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
    }
  }
}

/**
 * Replaces a file atomically: the content goes to a temp file in the same folder, is flushed to
 * disk, then renamed over the target. Readers see the old file or the new one, never a part.
 */
export async function writeFileAtomic(target: string, content: Buffer): Promise<void> {
  const temp = tempPathFor(target);
  try {
    const handle = await fs.promises.open(temp, "wx");
    try {
      await handle.writeFile(content);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await renameWithRetry(temp, target);
  } catch (error) {
    await fs.promises.rm(temp, { force: true }).catch(() => undefined);
    throw PERMISSION.has(code(error) ?? "") ? new PermissionError(target, error) : error;
  }
}

async function applyDirect(change: FileChange): Promise<void> {
  if (change.content === null) {
    try {
      await fs.promises.rm(change.target, { force: true });
    } catch (error) {
      throw PERMISSION.has(code(error) ?? "") ? new PermissionError(change.target, error) : error;
    }
    return;
  }
  await writeFileAtomic(change.target, change.content);
}

async function readOrNull(file: string): Promise<Buffer | null> {
  try {
    return await fs.promises.readFile(file);
  } catch (error) {
    if (code(error) === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function matches(change: FileChange): Promise<boolean> {
  const actual = await readOrNull(change.target);
  return change.content === null
    ? actual === null
    : actual !== null && sha256(actual) === sha256(change.content);
}

/**
 * Applies the changes in order as one unit: each file is written atomically and read back.
 * When a write fails, a check fails or the user declines elevation, every file already changed
 * gets its previous content back and the error is rethrown.
 */
export async function applyChanges(
  changes: FileChange[],
  elevate: ElevatedWriter | undefined
): Promise<void> {
  const previous = new Map<string, Buffer | null>();
  for (const change of changes) {
    previous.set(change.target, await readOrNull(change.target));
  }
  const done: FileChange[] = [];
  let elevated = false;
  const write = async (batch: FileChange[]) => {
    if (!elevated) {
      for (const [index, change] of batch.entries()) {
        try {
          await applyDirect(change);
          done.push(change);
        } catch (error) {
          if (!(error instanceof PermissionError) || !elevate) {
            throw error;
          }
          elevated = true;
          return write(batch.slice(index));
        }
      }
      return;
    }
    if (!elevate || !(await elevate(batch))) {
      throw new CancelledError();
    }
    done.push(...batch);
  };

  try {
    await write(changes);
    for (const change of changes) {
      if (!(await matches(change))) {
        throw new VerificationError(change.target);
      }
    }
  } catch (error) {
    const rollback = done
      .reverse()
      .map((change) => ({ target: change.target, content: previous.get(change.target) ?? null }));
    if (rollback.length > 0) {
      try {
        if (elevated && elevate) {
          await elevate(rollback);
        } else {
          for (const change of rollback) {
            await applyDirect(change);
          }
        }
      } catch {
        // The original error is more useful; the integrity check catches what is left.
      }
    }
    throw error;
  }
}

function quote(value: string): string {
  if (value.includes('"')) {
    throw new Error(`Unsupported character in path: ${value}`);
  }
  return `"${value}"`;
}

function sudoExec(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sudo.exec(command, { name: "UshiroE" }, (error) => (error ? reject(error) : resolve()));
  });
}

/**
 * Elevated writes with one administrator prompt. Content is staged in the temp folder, copied
 * next to the target under a temp name, then moved over the target, so the target is replaced
 * in one step and keeps no half-written state.
 */
export async function writeElevated(changes: FileChange[]): Promise<void> {
  if (changes.length === 0) {
    return;
  }
  const stagingDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ushiroe-"));
  try {
    const commands: string[] = [];
    for (const [index, change] of changes.entries()) {
      if (change.content === null) {
        commands.push(
          process.platform === "win32"
            ? `del /F /Q ${quote(change.target)}`
            : `rm -f ${quote(change.target)}`
        );
        continue;
      }
      const staged = path.join(stagingDir, `${index}.tmp`);
      await fs.promises.writeFile(staged, change.content);
      const temp = tempPathFor(change.target);
      commands.push(
        process.platform === "win32"
          ? `copy /Y ${quote(staged)} ${quote(temp)} && move /Y ${quote(temp)} ${quote(change.target)}`
          : `cp -f ${quote(staged)} ${quote(temp)} && mv -f ${quote(temp)} ${quote(change.target)}`
      );
    }
    await sudoExec(commands.join(" && "));
  } finally {
    await fs.promises.rm(stagingDir, { recursive: true, force: true });
  }
}
