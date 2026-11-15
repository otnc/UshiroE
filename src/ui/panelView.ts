import { randomBytes } from "node:crypto";
import path from "node:path";

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
import { resolveSourceImages } from "../core/resolve";
import type { LiveSync } from "../liveSync";
import type { BackImageMigration } from "../migration/backimageFlow";
import type { PatchManager } from "../patchManager";
import {
  removeSource,
  readSettings,
  setEnabled,
  setMode,
  updateArea,
  updateSource,
} from "../settings";
import { strings } from "./strings";

type IncomingMessage =
  | { type: "ready" }
  | { type: "setEnabled"; value: boolean }
  | { type: "setMode"; value: Mode }
  | { type: "updateArea"; id: AreaId; patch: Partial<AreaSettings> }
  | { type: "updateSource"; id: string; patch: Partial<ImageSource> }
  | { type: "removeSource"; id: string }
  | { type: "command"; command: string };

const ALLOWED_COMMANDS = new Set([
  "ushiroe.addImageFile",
  "ushiroe.addImageFolder",
  "ushiroe.addImageUrl",
  "ushiroe.nextImage",
  "ushiroe.repairPatch",
  "ushiroe.removePatch",
  "ushiroe.importBackImage",
  "ushiroe.exportSettings",
  "ushiroe.importSettings",
  "ushiroe.openSettings",
  "workbench.action.quit",
]);

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
  "path",
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
  private rootsKey = "";
  private readonly subscriptions: Disposable[] = [];

  constructor(
    private readonly extensionUri: Uri,
    private readonly patch: PatchManager,
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
    this.rootsKey = "";
    this.updateOptions(view.webview, readSettings().sources);
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

  /** Webviews can only show local files under their resource roots, so each source folder is one. */
  private updateOptions(webview: Webview, sources: ImageSource[]): void {
    const folders = sources
      .filter((source) => source.type !== "url")
      .map((source) => (source.type === "folder" ? source.path : path.dirname(source.path)));
    const key = JSON.stringify([...new Set(folders)].sort());
    if (key === this.rootsKey) {
      return;
    }
    this.rootsKey = key;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        Uri.joinPath(this.extensionUri, "dist"),
        ...folders.map((folder) => Uri.file(folder)),
      ],
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
      case "command":
        if (ALLOWED_COMMANDS.has(message.command)) {
          await commands.executeCommand(message.command);
        }
        return;
    }
  }

  async postState(): Promise<void> {
    const view = this.view;
    if (!view?.visible) {
      return;
    }
    const settings = readSettings();
    this.updateOptions(view.webview, settings.sources);
    const sources = await Promise.all(
      settings.sources.map(async (source) => {
        const images = await resolveSourceImages(source);
        const first = images[0];
        const thumbnail =
          first === undefined
            ? null
            : source.type === "url"
              ? first
              : view.webview.asWebviewUri(Uri.file(first)).toString();
        return { ...source, count: images.length, thumbnail };
      })
    );
    const patch = this.patch.status;
    await view.webview.postMessage({
      type: "state",
      settings,
      sources,
      status: {
        patch: patch?.state ?? "unknown",
        hasBackImage: patch?.hasBackImage ?? false,
        backImageInstalled: this.migration.installed,
        restartPending: this.patch.restartPending,
      },
    });
  }

  private html(webview: Webview): string {
    const nonce = randomBytes(16).toString("base64");
    const asset = (file: string) =>
      webview.asWebviewUri(Uri.joinPath(this.extensionUri, "dist", file)).toString();
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} https: data:`,
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
