import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WorkbenchEditor } from "../src/workbench/editor";
import { IntegrityError } from "../src/workbench/integrity";
import { LockedError } from "../src/workbench/lock";
import {
  assertOnlyChecksumChanged,
  buildPatchBlock,
  inspectPatch,
  readChecksum,
  vscodeChecksum,
} from "../src/workbench/patch";
import { WORKBENCH_SCRIPT_KEY } from "../src/workbench/paths";

const BASE = `\uFEFF${"line\r\n".repeat(400)}//# sourceMappingURL=https://example.com/main.js.map`;
const { block } = buildPatchBlock("var __ushiroeRuntime={start(){}};", {
  configUrl: "vscode-file://vscode-app/live.json",
  pollInterval: 1500,
});

function productJson(checksum: string): string {
  // BOM, CRLF and tabs, which must survive byte for byte.
  return `\uFEFF{\r\n\t"commit": "abc123",\r\n\t"checksums": {\r\n\t\t"${WORKBENCH_SCRIPT_KEY}": "${checksum}",\r\n\t\t"other": "keep"\r\n\t}\r\n}\r\n`;
}

describe("WorkbenchEditor", () => {
  let root: string;
  let appRoot: string;
  let scriptPath: string;
  let productPath: string;
  const editor = (stateDir = path.join(root, "state")) =>
    new WorkbenchEditor({ appRoot, stateDir, lockDir: root, minBytes: 1000 });

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "ushiroe-editor-"));
    appRoot = path.join(root, "app");
    fs.mkdirSync(path.join(appRoot, "out", "vs", "workbench"), { recursive: true });
    scriptPath = path.join(appRoot, "out", "vs", "workbench", "workbench.desktop.main.js");
    productPath = path.join(appRoot, "product.json");
    fs.writeFileSync(scriptPath, BASE, "utf8");
    fs.writeFileSync(productPath, productJson(vscodeChecksum(BASE)), "utf8");
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const script = () => fs.readFileSync(scriptPath, "utf8");
  const product = () => fs.readFileSync(productPath, "utf8");

  it("patches with a matching checksum and keeps product.json's formatting", async () => {
    expect(await editor().apply(block, true)).toBe(true);
    expect(script()).toBe(BASE + block);
    expect(product()).toBe(productJson(vscodeChecksum(BASE + block)));
    expect(readChecksum(product(), WORKBENCH_SCRIPT_KEY)).toBe(vscodeChecksum(script()));
  });

  it("records the original and a pristine backup, then restores from it", async () => {
    const instance = editor();
    await instance.apply(block, true);
    expect(instance.recordedOriginal("abc123")).toBe(vscodeChecksum(BASE));
    expect(fs.readFileSync(instance.backupFile("abc123"), "utf8")).toBe(BASE);
    expect(await instance.restore()).toBe("backup");
    expect(script()).toBe(BASE);
    expect(product()).toBe(productJson(vscodeChecksum(BASE)));
  });

  it("accepts a script BackImage restored while the checksum was still UshiroE's", async () => {
    const instance = editor();
    await instance.apply(block, true);
    fs.writeFileSync(scriptPath, BASE, "utf8");
    expect(await instance.apply(block, true)).toBe(true);
    expect(script()).toBe(BASE + block);
  });

  it("refuses a truncated script and leaves both files alone", async () => {
    fs.writeFileSync(scriptPath, BASE.slice(0, 600), "utf8");
    const before = product();
    await expect(editor().apply(block, true)).rejects.toBeInstanceOf(IntegrityError);
    expect(script()).toBe(BASE.slice(0, 600));
    expect(product()).toBe(before);
  });

  it("removes its block and puts VS Code's checksum back", async () => {
    await editor().apply(block, true);
    expect(await editor().remove()).toBe(true);
    expect(script()).toBe(BASE);
    expect(product()).toBe(productJson(vscodeChecksum(BASE)));
  });

  it("lets only one of two concurrent applies write", async () => {
    const results = await Promise.allSettled([
      editor().apply(block, true),
      editor().apply(block, true),
    ]);
    const rejected = results.filter((result) => result.status === "rejected");
    for (const result of rejected) {
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(LockedError);
    }
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    expect(script()).toBe(BASE + block);
    expect(inspectPatch(script()).hash).not.toBeNull();
    expect(readChecksum(product(), WORKBENCH_SCRIPT_KEY)).toBe(vscodeChecksum(script()));
  });

  it("refuses product.json changes beyond the one checksum", () => {
    const before = productJson("A");
    expect(() =>
      assertOnlyChecksumChanged(before, productJson("B"), WORKBENCH_SCRIPT_KEY)
    ).not.toThrow();
    expect(() =>
      assertOnlyChecksumChanged(
        before,
        productJson("B").replace("keep", "lost"),
        WORKBENCH_SCRIPT_KEY
      )
    ).toThrow();
    expect(() =>
      assertOnlyChecksumChanged(
        before,
        productJson("B").replace(/\r\n/g, "\n"),
        WORKBENCH_SCRIPT_KEY
      )
    ).toThrow();
  });
});
