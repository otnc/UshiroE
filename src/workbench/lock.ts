import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** A lock older than this is treated as left behind by a crashed window. */
export const LOCK_STALE_MS = 2 * 60 * 1000;

export class LockedError extends Error {
  constructor() {
    super("Another VS Code window is updating the workbench files right now.");
    this.name = "LockedError";
  }
}

interface LockContent {
  pid: number;
  at: number;
}

/** One lock per VS Code installation, shared by all of its windows. */
export function lockPathFor(appRoot: string, dir = os.tmpdir()): string {
  const id = createHash("sha256").update(path.resolve(appRoot).toLowerCase()).digest("hex");
  return path.join(dir, `ushiroe-${id.slice(0, 16)}.lock`);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function isStale(lockPath: string, now: number): Promise<boolean> {
  try {
    const content = JSON.parse(await fs.promises.readFile(lockPath, "utf8")) as LockContent;
    return now - content.at > LOCK_STALE_MS || !isAlive(content.pid);
  } catch {
    // Unreadable or half-written: only stale once it is old enough.
    const stat = await fs.promises.stat(lockPath).catch(() => null);
    return stat === null || now - stat.mtimeMs > LOCK_STALE_MS;
  }
}

/**
 * Takes the lock, or returns null when another live process holds it. A stale lock is taken over. Call the returned function to release it.
 */
export async function tryAcquireLock(
  lockPath: string,
  now = Date.now()
): Promise<(() => Promise<void>) | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await fs.promises.open(lockPath, "wx");
      try {
        await handle.writeFile(JSON.stringify({ pid: process.pid, at: now } satisfies LockContent));
      } finally {
        await handle.close();
      }
      return async () => {
        await fs.promises.rm(lockPath, { force: true });
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      if (attempt > 0 || !(await isStale(lockPath, now))) {
        return null;
      }
      await fs.promises.rm(lockPath, { force: true });
    }
  }
  return null;
}

/** Runs `task` while holding the lock, throwing {@link LockedError} when it is held elsewhere. */
export async function withLock<T>(lockPath: string, task: () => Promise<T>): Promise<T> {
  const release = await tryAcquireLock(lockPath);
  if (!release) {
    throw new LockedError();
  }
  try {
    return await task();
  } finally {
    await release();
  }
}
