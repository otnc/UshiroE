import fs from "node:fs";

import { type ExtensionContext, Uri, commands, env, window, workspace } from "vscode";

import {
  addImageFiles,
  addImageFolder,
  addImageUrl,
  exportSettings,
  importSettings,
} from "./commands";
import { LibraryManager } from "./libraryManager";
import { LiveStore } from "./liveStore";
import { LiveSync } from "./liveSync";
import { BackImageMigration } from "./migration/backimageFlow";
import { PatchManager } from "./patchManager";
import { Patcher } from "./patcher";
import {
  applyPresetCommand,
  applyRandomPreset,
  applyRandomPresetOnStartup,
  deletePreset,
  savePreset,
} from "./presetCommands";
import { SECTION, readSettings, setEnabled } from "./settings";
import { PanelViewProvider } from "./ui/panelView";

/** How often a visible window re-reads the live config, in milliseconds. */
const POLL_INTERVAL = 1500;

/** Internal handles returned from `activate`, used by the integration tests. */
export interface UshiroeApi {
  liveFile: string;
  patcher: Patcher;
  live: LiveSync;
  library: LibraryManager;
}

export async function activate(context: ExtensionContext): Promise<UshiroeApi> {
  const store = new LiveStore(context.globalStorageUri.fsPath);
  const patcher = new Patcher(Uri.joinPath(context.extensionUri, "dist", "runtime.js").fsPath, {
    configUrl: store.url,
    pollInterval: POLL_INTERVAL,
  });
  const patch = new PatchManager(context, patcher);
  const library = new LibraryManager();
  const live = new LiveSync(store, library.lookup);
  const migration = new BackImageMigration(context, patch);
  const panel = new PanelViewProvider(context.extensionUri, patch, library, live, migration);

  let wasEnabled = readSettings().enabled;
  context.subscriptions.push(
    patch,
    library,
    live,
    panel,
    library.onDidChange(() => live.schedule()),
    window.registerWebviewViewProvider(PanelViewProvider.viewId, panel),
    workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration(SECTION)) {
        return;
      }
      live.schedule();
      void library.settingsChanged();
      const enabled = readSettings().enabled;
      if (enabled && !wasEnabled) {
        void patch.ensure("enable");
      }
      wasEnabled = enabled;
    }),
    commands.registerCommand("ushiroe.enable", () => setEnabled(true)),
    commands.registerCommand("ushiroe.disable", () => setEnabled(false)),
    commands.registerCommand("ushiroe.toggle", () => setEnabled(!readSettings().enabled)),
    commands.registerCommand("ushiroe.nextImage", () => live.nextImage()),
    commands.registerCommand("ushiroe.addImageFile", addImageFiles),
    commands.registerCommand("ushiroe.addImageFolder", addImageFolder),
    commands.registerCommand("ushiroe.addImageUrl", () => addImageUrl(library)),
    commands.registerCommand("ushiroe.refreshImages", () => library.refreshAll()),
    commands.registerCommand("ushiroe.refreshSource", (id: string) => library.refreshSource(id)),
    commands.registerCommand("ushiroe.chooseLibraryFolder", () => library.chooseFolder()),
    commands.registerCommand("ushiroe.resetLibraryFolder", () => library.resetFolder()),
    commands.registerCommand("ushiroe.openLibrary", async () => {
      await fs.promises.mkdir(library.root, { recursive: true });
      await env.openExternal(Uri.file(library.root));
    }),
    commands.registerCommand("ushiroe.savePreset", savePreset),
    commands.registerCommand("ushiroe.applyPreset", applyPresetCommand),
    commands.registerCommand("ushiroe.deletePreset", deletePreset),
    commands.registerCommand("ushiroe.randomPreset", applyRandomPreset),
    commands.registerCommand("ushiroe.repairPatch", () => patch.ensure("manual")),
    commands.registerCommand("ushiroe.removePatch", () => patch.remove()),
    commands.registerCommand("ushiroe.importBackImage", () => migration.import()),
    commands.registerCommand("ushiroe.exportSettings", exportSettings),
    commands.registerCommand("ushiroe.importSettings", importSettings),
    commands.registerCommand("ushiroe.openSettings", () =>
      commands.executeCommand("workbench.action.openSettings", `@ext:${context.extension.id}`)
    )
  );

  await applyRandomPresetOnStartup(context);
  await live.sync();
  await patch.refresh();
  if (wasEnabled) {
    await patch.ensure("startup");
  }
  // Copying and downloading can take a while; the live config follows once they finish.
  void library.startup();
  void migration.offer();

  return { liveFile: store.file, patcher, live, library };
}

export function deactivate(): void {}
