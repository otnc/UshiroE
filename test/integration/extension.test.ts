import * as assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as vscode from "vscode";

import type { UshiroeApi } from "../../src/extension";

const EXTENSION_ID = "otoneko1102.ushiroe";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function config() {
  return vscode.workspace.getConfiguration("ushiroe");
}

async function waitFor<T>(read: () => T | undefined, timeout = 10_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = read();
    if (value !== undefined) {
      return value;
    }
    if (Date.now() - start > timeout) {
      throw new Error("Timed out waiting for a condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function readLive(file: string): { enabled: boolean; areas: { images: string[] }[] } | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

describe("UshiroE in VS Code", function () {
  this.timeout(60_000);

  let api: UshiroeApi;
  let work: string;

  before(async () => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), "ushiroe-it-"));
    const extension = vscode.extensions.getExtension<UshiroeApi>(EXTENSION_ID);
    assert.ok(extension, "the extension is installed");
    api = await extension.activate();
  });

  after(async () => {
    for (const key of ["enabled", "sources", "fullscreen", "libraryFolder", "mode"]) {
      await config().update(key, undefined, vscode.ConfigurationTarget.Global);
    }
    fs.rmSync(work, { recursive: true, force: true });
  });

  it("registers every contributed command", async () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    const contributed = (extension?.packageJSON.contributes.commands as { command: string }[]).map(
      (entry) => entry.command
    );
    const registered = new Set(await vscode.commands.getCommands(true));
    assert.deepEqual(
      contributed.filter((command) => !registered.has(command)),
      []
    );
  });

  it("copies images with non-ASCII paths into the library folder", async () => {
    const originals = path.join(work, "元画像");
    fs.mkdirSync(originals);
    fs.writeFileSync(path.join(originals, "背景.png"), PNG);
    const library = path.join(work, "library");
    await config().update("libraryFolder", library, vscode.ConfigurationTarget.Global);
    await config().update(
      "sources",
      [{ id: "it", name: "背景", type: "folder", path: originals }],
      vscode.ConfigurationTarget.Global
    );
    const copies = await waitFor(() => {
      const images = api.library.lookup({
        id: "it",
        name: "",
        type: "folder",
        path: originals,
        description: "",
        random: false,
        interval: 10,
        recursive: false,
        refresh: "never",
      });
      return images.length > 0 ? images : undefined;
    });
    assert.equal(copies.length, 1);
    assert.ok(copies[0].startsWith(library));
    assert.match(path.basename(copies[0]), /^[0-9a-f]{16}\.png$/);
  });

  it("patches the workbench, shows the copies in the live config and removes the patch", async () => {
    assert.equal(await api.patcher.apply(true), true);
    assert.equal((await api.patcher.status()).state, "applied");

    // With the patch already applied, turning the background on needs no consent dialog.
    await config().update("fullscreen", { source: "it" }, vscode.ConfigurationTarget.Global);
    await config().update("enabled", true, vscode.ConfigurationTarget.Global);
    const live = await waitFor(() => {
      const value = readLive(api.liveFile);
      return value?.enabled && value.areas.length > 0 ? value : undefined;
    });
    assert.match(live.areas[0].images[0], /^vscode-file:\/\/vscode-app\/.+\/[0-9a-f]{16}\.png$/);

    assert.equal(await api.patcher.remove(), true);
    assert.equal((await api.patcher.status()).state, "missing");
  });
});
