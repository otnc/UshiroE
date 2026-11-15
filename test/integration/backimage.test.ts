import * as assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import * as vscode from "vscode";

import type { UshiroeApi } from "../../src/extension";

const SCRIPT = path.join(vscode.env.appRoot, "out", "vs", "workbench", "workbench.desktop.main.js");
const PRODUCT = path.join(vscode.env.appRoot, "product.json");

function hashOf(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function config() {
  return vscode.workspace.getConfiguration("ushiroe");
}

/** Runs next to the BackImage test double, which is active in this session. */
describe("UshiroE next to an active BackImage", function () {
  this.timeout(60_000);

  let api: UshiroeApi;
  let original: { script: string; product: string };

  before(async () => {
    assert.ok(
      vscode.extensions.getExtension("ROBOTofficial.backimage"),
      "the test double is active"
    );
    const extension = vscode.extensions.getExtension<UshiroeApi>("otoneko1102.ushiroe");
    assert.ok(extension);
    api = await extension.activate();
    original = { script: hashOf(SCRIPT), product: hashOf(PRODUCT) };
  });

  after(async () => {
    for (const key of ["enabled", "backImage.priority"]) {
      await config().update(key, undefined, vscode.ConfigurationTarget.Global);
    }
    for (const backup of [`${SCRIPT}.backup`, SCRIPT.replace(/\.js$/, ".css.backup")]) {
      fs.rmSync(backup, { force: true });
    }
  });

  function assertUntouched(): void {
    assert.equal(hashOf(SCRIPT), original.script, "workbench.desktop.main.js was not written");
    assert.equal(hashOf(PRODUCT), original.product, "product.json was not written");
  }

  it("writes nothing and warns when UshiroE has priority", async () => {
    await config().update("backImage.priority", "ushiroe", vscode.ConfigurationTarget.Global);
    await config().update("enabled", true, vscode.ConfigurationTarget.Global);
    await api.patch.ensure("manual");
    assert.equal(api.patch.lastBlocked, "conflict");
    assert.equal(api.patch.ownership().kind, "conflict");
    assertUntouched();
  });

  it("writes nothing and skips startup repair when BackImage has priority", async () => {
    await config().update("backImage.priority", "backImage", vscode.ConfigurationTarget.Global);
    await api.patch.ensure("startup");
    assert.equal(api.patch.lastBlocked, "backImage");
    await api.patch.ensure("manual");
    assert.equal(api.patch.lastBlocked, "backImage");
    assertUntouched();
  });
});
