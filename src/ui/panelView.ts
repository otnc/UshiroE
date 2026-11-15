import { randomBytes } from "node:crypto";

import {
  type CancellationToken,
  type Disposable,
  Uri,
  type Webview,
  type WebviewView,
  type WebviewViewProvider,
  type WebviewViewResolveContext,
  commands,
  env,
} from "vscode";

import {
  AREA_IDS,
  type AreaId,
  type AreaSettings,
  type ImageSource,
  MODES,
  type Mode,
} from "../core/model";
import type { LibraryManager } from "../libraryManager";
import type { LiveSync } from "../liveSync";
import type { BackImageMigration } from "../migration/backimageFlow";
import type { PatchManager } from "../patchManager";
import {
  readSettings,
  removeSource,
  setEnabled,
  setMode,
  setRandomPresetOnStartup,
  setShuffleInterval,
  updateArea,
  updateSource,
} from "../settings";
import { strings } from "./strings";

type IncomingMessage =
  | { type: "ready" }
  | { type: "setEnabled"; value: boolean }
  | { type: "setMode"; value: Mode }
  | { type: "setShuffleInterval"; value: number }
  | { type: "setRandomPresetOnStartup"; value: boolean }
  | { type: "updateArea"; id: AreaId; patch: Partial<AreaSettings> }
  | { type: "updateSource"; id: string; patch: Partial<ImageSource> }
  | { type: "removeSource"; id: string }
  | { type: "command"; command: string; arg?: string };

/** Commands the webview may run, and whether each one takes the clicked item's id. */
const ALLOWED_COMMANDS: Record<string, boolean> = {
  "ushiroe.addImageFile": false,
  "ushiroe.addImageFolder": false,
  "ushiroe.addImageUrl": false,
  "ushiroe.nextImage": false,
  "ushiroe.refreshImages": false,
  "ushiroe.refreshSource": true,
  "ushiroe.openLibrary": false,
  "ushiroe.chooseLibraryFolder": false,
  "ushiroe.resetLibraryFolder": false,
  "ushiroe.savePreset": false,
  "ushiroe.applyPreset": true,
  "ushiroe.deletePreset": true,
  "ushiroe.randomPreset": false,
  "ushiroe.repairPatch": false,
  "ushiroe.removePatch": false,
  "ushiroe.importBackImage": false,
  "ushiroe.uninstallBackImage": false,
  "ushiroe.disableBackImage": false,
  "ushiroe.setBackImagePriority": true,
  "ushiroe.restoreWorkbench": false,
  "ushiroe.exportSettings": false,
  "ushiroe.importSettings": false,
  "ushiroe.openSettings": false,
  "workbench.action.quit": false,
};

const AREA_PATCH_KEYS = new Set<keyof AreaSettings>([
  "enabled",
  "source",
  "opacity",
  "size",
  "position",
  "blur",
]);
const SOURCE_PATCH_KEYS = new Set<keyof ImageSource>([
  "name",
  "description",
  "random",
  "interval",
  "recursive",
  "refresh",
]);

function pickKeys<T extends object>(patch: unknown, allowed: Set<keyof T>): Partial<T> {
  if (typeof patch !== "object" || patch === null) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(patch).filter(([key]) => allowed.has(key as keyof T))
  ) as Partial<T>;
}

export class PanelViewProvider implements WebviewViewProvider, Disposable {
  static readonly viewId = "ushiroe.panel";

  private view: WebviewView | undefined;
  private allowedRoot: string | undefined;
  private readonly subscriptions: Disposable[] = [];

  constructor(
    private readonly extensionUri: Uri,
    private readonly patch: PatchManager,
    private readonly library: LibraryManager,
    live: LiveSync,
    private readonly migration: BackImageMigration
  ) {
    this.subscriptions.push(
      patch.onDidChange(() => void this.postState()),
      live.onDidChange(() => void this.postState())
    );
  }

  resolveWebviewView(
    view: WebviewView,
    _context: WebviewViewResolveContext,
    _token: CancellationToken
  ): void {
    this.view = view;
    this.allowedRoot = undefined;
    this.updateOptions(view.webview);
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage(
      (message: IncomingMessage) => void this.handle(message),
      undefined,
      this.subscriptions
    );
    view.onDidChangeVisibility(
      () => {
        if (view.visible) {
          void this.postState();
        }
      },
      undefined,
      this.subscriptions
    );
  }

  /** Every image shown is a copy in the library, so the library is the only folder needed. */
  private updateOptions(webview: Webview): void {
    const root = this.library.root;
    if (root === this.allowedRoot) {
      return;
    }
    this.allowedRoot = root;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.extensionUri, "dist"), Uri.file(root)],
    };
  }

  private async handle(message: IncomingMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        await this.postState();
        return;
      case "setEnabled":
        await setEnabled(message.value === true);
        return;
      case "setMode":
        if ((MODES as readonly string[]).includes(message.value)) {
          await setMode(message.value);
        }
        return;
      case "setShuffleInterval":
        if (typeof message.value === "number" && Number.isFinite(message.value)) {
          await setShuffleInterval(message.value);
        }
        return;
      case "setRandomPresetOnStartup":
        await setRandomPresetOnStartup(message.value === true);
        return;
      case "updateArea":
        if ((AREA_IDS as readonly string[]).includes(message.id)) {
          await updateArea(message.id, pickKeys<AreaSettings>(message.patch, AREA_PATCH_KEYS));
        }
        return;
      case "updateSource":
        await updateSource(message.id, pickKeys<ImageSource>(message.patch, SOURCE_PATCH_KEYS));
        return;
      case "removeSource":
        await removeSource(message.id);
        return;
      case "command": {
        const takesArg = ALLOWED_COMMANDS[message.command];
        if (takesArg === undefined) {
          return;
        }
        await (takesArg
          ? commands.executeCommand(message.command, message.arg)
          : commands.executeCommand(message.command));
        return;
      }
    }
  }

  async postState(): Promise<void> {
    const view = this.view;
    if (!view?.visible) {
      return;
    }
    this.updateOptions(view.webview);
    const settings = readSettings();
    const sources = settings.sources.map((source) => {
      const images = this.library.lookup(source);
      return {
        ...source,
        count: images.length,
        thumbnail:
          images[0] === undefined
            ? null
            : view.webview.asWebviewUri(Uri.file(images[0])).toString(),
      };
    });
    const patch = this.patch.status;
    await view.webview.postMessage({
      type: "state",
      settings,
      sources,
      library: {
        root: this.library.root,
        isDefault: this.library.root === this.library.defaultRoot,
      },
      status: {
        patch: patch?.state ?? "unknown",
        hasBackImage: patch?.hasBackImage ?? false,
        backImageInstalled: this.migration.installed,
        restartPending: this.patch.restartPending,
        waitingForRestart: this.patch.waitingForRestart,
        ownership: this.patch.ownership(),
        problem: patch?.problem ?? null,
      },
    });
  }

  private html(webview: Webview): string {
    const nonce = randomBytes(16).toString("base64");
    const asset = (file: string) =>
      webview.asWebviewUri(Uri.joinPath(this.extensionUri, "dist", file)).toString();
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");
    const locale = JSON.stringify(strings()).replace(/</g, "\\u003c");
    return `<!DOCTYPE html>
<html lang="${env.language}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${asset("codicons/codicon.css")}">
<link rel="stylesheet" href="${asset("panel.css")}">
<title>UshiroE</title>
</head>
<body>
<div id="app"></div>
<script nonce="${nonce}">window.USHIROE_STRINGS = ${locale};</script>
<script nonce="${nonce}" src="${asset("panel.js")}"></script>
</body>
</html>`;
  }

  dispose(): void {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }
}
