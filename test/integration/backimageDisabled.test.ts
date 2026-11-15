import * as assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import * as vscode from "vscode";

import type { UshiroeApi } from "../../src/extension";

/** The folder test-cli installs extensions into: `.vscode-test/extensions`. */
function testExtensionsDir(): string {
  let dir = vscode.env.appRoot;
  while (path.basename(dir) !== ".vscode-test") {
    const parent = path.dirname(dir);
    assert.notEqual(parent, dir, "the test VS Code runs from .vscode-test");
    dir = parent;
  }
  return path.join(dir, "extensions");
}

/** The BackImage test double is installed, then disabled with --disable-extension. */
describe("UshiroE next to a disabled BackImage", () => {
  it("is really installed, so the next check is about it being disabled", () => {
    const installed = fs
      .readdirSync(testExtensionsDir())
      .some((name) => name.toLowerCase().startsWith("robotofficial.backimage-"));
    assert.ok(installed, "the BackImage test double is installed");
  });

  it("does not treat a disabled BackImage as active", async () => {
    assert.equal(vscode.extensions.getExtension("ROBOTofficial.backimage"), undefined);
    const extension = vscode.extensions.getExtension<UshiroeApi>("otoneko1102.ushiroe");
    assert.ok(extension);
    const api = await extension.activate();
    assert.equal(api.patch.backImageActive, false);
    assert.equal(api.patch.ownership().kind, "ushiroe");
  });
});
