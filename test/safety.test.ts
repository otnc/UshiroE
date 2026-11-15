import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { decideOwnership } from "../src/core/ownership";
import { decideStartupRepair, resetRepairs } from "../src/core/repairGuard";
import { applyChanges, writeFileAtomic } from "../src/workbench/fileio";
import { checkIntegrity } from "../src/workbench/integrity";
import { LockedError, tryAcquireLock, withLock } from "../src/workbench/lock";
import { buildPatchBlock, vscodeChecksum } from "../src/workbench/patch";

const BASE = `${"x".repeat(2000)}\n//# sourceMappingURL=https://example.com/main.js.map`;
const { block } = buildPatchBlock("var __ushiroeRuntime={start(){}};", {
  configUrl: "vscode-file://vscode-app/live.json",
  pollInterval: 1500,
});
const BACKIMAGE = "\n//backimage.1.1.6-abc\n;(function(){})();\n//END.backimage.1.1.6";

describe("decideOwnership", () => {
  const none = { active: false, hasBlock: false, hasBackups: false };
  it("lets UshiroE write when BackImage is not running", () => {
    expect(decideOwnership("ushiroe", none)).toEqual({
      kind: "ushiroe",
      cleanupBackImage: false,
      priorityIgnored: false,
    });
    expect(decideOwnership("backImage", none)).toMatchObject({
      kind: "ushiroe",
      priorityIgnored: true,
    });
  });

  it("asks to clean up leftovers of a BackImage that no longer runs", () => {
    expect(decideOwnership("ushiroe", { ...none, hasBlock: true })).toMatchObject({
      cleanupBackImage: true,
    });
    expect(decideOwnership("ushiroe", { ...none, hasBackups: true })).toMatchObject({
      cleanupBackImage: true,
    });
  });

  it("never writes while BackImage is active", () => {
    const active = { active: true, hasBlock: true, hasBackups: true };
    expect(decideOwnership("ushiroe", active)).toEqual({ kind: "conflict" });
    expect(decideOwnership("backImage", active)).toEqual({ kind: "backImage" });
  });
});

describe("decideStartupRepair", () => {
  it("repairs once per commit, then stops and warns only once", () => {
    const first = decideStartupRepair(undefined, "c1", true, 1);
    expect(first.action).toBe("repair");
    const second = decideStartupRepair(first.record, "c1", true, 2);
    expect(second).toMatchObject({ action: "stop", warn: true });
    const third = decideStartupRepair(second.record, "c1", true, 3);
    expect(third).toMatchObject({ action: "stop", warn: false });
  });

  it("repairs again after a VS Code update or a manual repair", () => {
    const first = decideStartupRepair(undefined, "c1", true, 1);
    expect(decideStartupRepair(first.record, "c2", true, 2).action).toBe("repair");
    expect(decideStartupRepair(resetRepairs("c1"), "c1", true, 2).action).toBe("repair");
  });

  it("does nothing while the patch is in place", () => {
    expect(decideStartupRepair(undefined, "c1", false, 1).action).toBe("none");
  });
});

describe("checkIntegrity", () => {
  const minBytes = 1000;
  const pristine = vscodeChecksum(BASE);

  it("accepts the pristine script", () => {
    expect(
      checkIntegrity({ script: BASE, productChecksum: pristine, recordedOriginal: null, minBytes })
    ).toMatchObject({ ok: true, basePristine: true });
  });

  it("accepts UshiroE's own patch with either checksum choice", () => {
    const patched = BASE + block;
    expect(
      checkIntegrity({
        script: patched,
        productChecksum: pristine,
        recordedOriginal: null,
        minBytes,
      }).ok
    ).toBe(true);
    expect(
      checkIntegrity({
        script: patched,
        productChecksum: vscodeChecksum(patched),
        recordedOriginal: null,
        minBytes,
      }).ok
    ).toBe(true);
  });

  it("accepts a pristine script restored by BackImage while the checksum is still UshiroE's", () => {
    expect(
      checkIntegrity({
        script: BASE,
        productChecksum: vscodeChecksum(BASE + block),
        recordedOriginal: pristine,
        minBytes,
      }).ok
    ).toBe(true);
  });

  it("accepts a script with both blocks when the base is known", () => {
    expect(
      checkIntegrity({
        script: BASE + BACKIMAGE + block,
        productChecksum: pristine,
        recordedOriginal: null,
        minBytes,
      }).ok
    ).toBe(true);
  });

  it("refuses a truncated script", () => {
    const big = `${"y".repeat(600_000)}\n//# sourceMappingURL=x`;
    const truncated = Buffer.from(big + block)
      .subarray(0, 524288)
      .toString("utf8");
    expect(
      checkIntegrity({
        script: truncated,
        productChecksum: vscodeChecksum(big),
        recordedOriginal: null,
        minBytes,
      })
    ).toEqual({ ok: false, reason: "truncated" });
  });

  it("refuses an unknown modification, even with a matching whole-file checksum", () => {
    const modified = BASE.replace("xxx", "evil") + block;
    expect(
      checkIntegrity({
        script: modified,
        productChecksum: pristine,
        recordedOriginal: pristine,
        minBytes,
      })
    ).toEqual({ ok: false, reason: "modified" });
    const broken = BASE + block.replace("start(){}", "start(){1}");
    expect(
      checkIntegrity({
        script: broken,
        productChecksum: vscodeChecksum(broken),
        recordedOriginal: null,
        minBytes,
      })
    ).toEqual({ ok: false, reason: "modified" });
  });
});

describe("locks and atomic writes", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ushiroe-safety-"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("allows one holder at a time and takes over stale locks", async () => {
    const lock = path.join(dir, "a.lock");
    const release = await tryAcquireLock(lock);
    expect(release).not.toBeNull();
    expect(await tryAcquireLock(lock)).toBeNull();
    await release?.();
    expect(fs.existsSync(lock)).toBe(false);

    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, at: Date.now() - 10 * 60_000 }));
    const takeover = await tryAcquireLock(lock);
    expect(takeover).not.toBeNull();
    await takeover?.();

    fs.writeFileSync(lock, JSON.stringify({ pid: 2 ** 30, at: Date.now() }));
    expect(await tryAcquireLock(lock)).not.toBeNull();
  });

  it("releases the lock when the task fails", async () => {
    const lock = path.join(dir, "b.lock");
    await expect(
      withLock(lock, async () => {
        await expect(withLock(lock, async () => undefined)).rejects.toBeInstanceOf(LockedError);
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(fs.existsSync(lock)).toBe(false);
  });

  it("leaves the target untouched and removes the temp file when the rename fails", async () => {
    const target = path.join(dir, "file.js");
    fs.writeFileSync(target, "old");
    vi.spyOn(fs.promises, "rename").mockRejectedValue(
      Object.assign(new Error("busy"), { code: "EXDEV" })
    );
    await expect(writeFileAtomic(target, Buffer.from("new"))).rejects.toThrow("busy");
    expect(fs.readFileSync(target, "utf8")).toBe("old");
    expect(fs.readdirSync(dir)).toEqual(["file.js"]);
  });

  it("rolls every file back when a written file does not read back", async () => {
    const script = path.join(dir, "script.js");
    const product = path.join(dir, "product.json");
    fs.writeFileSync(script, "old script");
    fs.writeFileSync(product, "old product");
    const realReadFile = fs.promises.readFile.bind(fs.promises);
    let reads = 0;
    vi.spyOn(fs.promises, "readFile").mockImplementation((async (
      file: fs.PathLike,
      ...rest: unknown[]
    ) => {
      // The third read of product.json is the verification after writing.
      if (String(file) === product && ++reads === 2) {
        return Buffer.from("garbled");
      }
      return realReadFile(file as string, ...(rest as []));
    }) as typeof fs.promises.readFile);
    await expect(
      applyChanges(
        [
          { target: script, content: Buffer.from("new script") },
          { target: product, content: Buffer.from("new product") },
        ],
        undefined
      )
    ).rejects.toThrow("did not contain what was written");
    vi.restoreAllMocks();
    expect(fs.readFileSync(script, "utf8")).toBe("old script");
    expect(fs.readFileSync(product, "utf8")).toBe("old product");
  });
});

describe("sign-in safety", () => {
  function sources(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? sources(full) : full.endsWith(".ts") ? [full] : [];
    });
  }

  it("never touches VS Code's shared storage or the secrets API", () => {
    const offenders = sources("src").filter((file) => {
      const text = fs.readFileSync(file, "utf8");
      return /\.vscode-shared|\bsecrets\b|SecretStorage/.test(text);
    });
    expect(offenders).toEqual([]);
  });
});
