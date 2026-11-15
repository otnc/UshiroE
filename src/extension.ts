import { type ExtensionContext, Uri, commands, window, workspace } from "vscode";

import {
  addImageFiles,
  addImageFolder,
  addImageUrl,
  exportSettings,
  importSettings,
} from "./commands";
import { Controller } from "./controller";
import { LiveStore } from "./liveStore";
import { Patcher } from "./patcher";
import { readSettings, setEnabled, updateArea } from "./settings";
import { PanelViewProvider } from "./ui/panelView";

/** How often a visible window re-reads the live config, in milliseconds. */
const POLL_INTERVAL = 1500;

/** Points the first image added to an otherwise empty setup at the area that is currently shown. */
async function assignIfUnset(ids: string[]): Promise<void> {
  const settings = readSettings();
  if (ids.length === 0) {
    return;
  }
  if (settings.mode === "fullscreen" && settings.areas.fullscreen.source === null) {
    await updateArea("fullscreen", { source: ids[0] });
  }
}

export async function activate(context: ExtensionContext): Promise<void> {
  const live = new LiveStore(context.globalStorageUri.fsPath);
  const patcher = new Patcher(Uri.joinPath(context.extensionUri, "dist", "runtime.js").fsPath, {
    configUrl: live.url,
    pollInterval: POLL_INTERVAL,
  });
  const controller = new Controller(context, patcher, live);
  const panel = new PanelViewProvider(context.extensionUri, controller);

  context.subscriptions.push(
    controller,
    panel,
    window.registerWebviewViewProvider(PanelViewProvider.viewId, panel),
    workspace.onDidChangeConfiguration((event) => controller.onConfigurationChanged(event)),
    commands.registerCommand("ushiroe.enable", () => setEnabled(true)),
    commands.registerCommand("ushiroe.disable", () => setEnabled(false)),
    commands.registerCommand("ushiroe.toggle", () => setEnabled(!readSettings().enabled)),
    commands.registerCommand("ushiroe.nextImage", () => controller.nextImage()),
    commands.registerCommand("ushiroe.addImageFile", async () =>
      assignIfUnset(await addImageFiles())
    ),
    commands.registerCommand("ushiroe.addImageFolder", async () =>
      assignIfUnset(await addImageFolder())
    ),
    commands.registerCommand("ushiroe.addImageUrl", async () => assignIfUnset(await addImageUrl())),
    commands.registerCommand("ushiroe.repairPatch", () => controller.ensurePatch("manual")),
    commands.registerCommand("ushiroe.removePatch", () => controller.removePatch()),
    commands.registerCommand("ushiroe.importBackImage", () => controller.importBackImage()),
    commands.registerCommand("ushiroe.exportSettings", exportSettings),
    commands.registerCommand("ushiroe.importSettings", importSettings),
    commands.registerCommand("ushiroe.openSettings", () =>
      commands.executeCommand("workbench.action.openSettings", `@ext:${context.extension.id}`)
    )
  );

  await controller.start();
}

export function deactivate(): void {}
