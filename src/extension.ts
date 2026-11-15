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
import { deletePreset, newPreset } from "./presetCommands";
import { SECTION, readSettings, setEnabled } from "./settings";
import { PanelViewProvider } from "./ui/panelView";

/** How often a visible window re-reads the live config, in milliseconds. */
const POLL_INTERVAL = 1500;

/** Internal handles returned from `activate`, used by the integration tests. */
export interface UshiroeApi {
  liveFile: string;
  patcher: Patcher;
  patch: PatchManager;
  live: LiveSync;
  library: LibraryManager;
  /** This extension's log folder, inside the window's log folder. */
  logDir: string;
}

export async function activate(context: ExtensionContext): Promise<UshiroeApi> {
  const store = new LiveStore(context.globalStorageUri.fsPath);
  const patcher = new Patcher(
    Uri.joinPath(context.extensionUri, "dist", "runtime.js").fsPath,
    { configUrl: store.url, pollInterval: POLL_INTERVAL },
    context.globalStorageUri.fsPath
  );
  const patch = new PatchManager(context, patcher);
  const library = new LibraryManager();
  const live = new LiveSync(store, library.resolver);
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
      if (event.affectsConfiguration(`${SECTION}.backImage.priority`)) {
        void patch.refresh();
      }
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
    commands.registerCommand("ushiroe.refreshSource", (id: unknown) => library.refreshSource(id)),
    commands.registerCommand("ushiroe.addImagesToSource", (id: unknown) => library.addImagesTo(id)),
    commands.registerCommand("ushiroe.openSourceFolder", (id: unknown) =>
      library.openSourceFolder(id)
    ),
    commands.registerCommand("ushiroe.chooseLibraryFolder", () => library.chooseFolder()),
    commands.registerCommand("ushiroe.resetLibraryFolder", () => library.resetFolder()),
    commands.registerCommand("ushiroe.openLibrary", async () => {
      await fs.promises.mkdir(library.root, { recursive: true });
      await env.openExternal(Uri.file(library.root));
    }),
    commands.registerCommand("ushiroe.newPreset", newPreset),
    commands.registerCommand("ushiroe.deletePreset", deletePreset),
    commands.registerCommand("ushiroe.repairPatch", () => patch.ensure("manual")),
    commands.registerCommand("ushiroe.removePatch", () => patch.remove()),
    commands.registerCommand("ushiroe.restoreWorkbench", () => patch.restoreWorkbench()),
    commands.registerCommand("ushiroe.uninstallBackImage", () => migration.uninstall()),
    commands.registerCommand("ushiroe.disableBackImage", () => migration.disable()),
    commands.registerCommand("ushiroe.setBackImagePriority", (priority: unknown) =>
      patch.setPriority(priority === "backImage" ? "backImage" : "ushiroe")
    ),
    commands.registerCommand("ushiroe.importBackImage", () => migration.import()),
    commands.registerCommand("ushiroe.exportSettings", exportSettings),
    commands.registerCommand("ushiroe.importSettings", importSettings),
    commands.registerCommand("ushiroe.openSettings", () =>
      commands.executeCommand("workbench.action.openSettings", `@ext:${context.extension.id}`)
    )
  );

  await live.sync();
  await patch.refresh();
  // Not awaited: dialogs and administrator prompts must not hold up activation.
  void (async () => {
    await patch.offerLeftoverRemoval();
    if (wasEnabled) {
      // Right after BackImage stopped, the patch is due regardless of the repair limit.
      await patch.ensure((await migration.takePatchAfterRestart()) ? "enable" : "startup");
    }
  })();
  // Copying and downloading can take a while; the live config follows once they finish.
  void library.startup();
  void migration.offer();

  return { liveFile: store.file, patcher, patch, live, library, logDir: context.logUri.fsPath };
}

export function deactivate(): void {}
