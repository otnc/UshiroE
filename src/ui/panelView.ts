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
  type Preset,
  type Rotation,
} from "../core/model";
import { imageRef, moveItem } from "../core/presets";
import type { LibraryManager } from "../libraryManager";
import type { LiveSync } from "../liveSync";
import type { BackImageMigration } from "../migration/backimageFlow";
import type { PatchManager } from "../patchManager";
import {
  moveSource,
  readSettings,
  removeSource,
  setEnabled,
  setMode,
  updateAllImages,
  updateArea,
  updatePreset,
  updateSource,
} from "../settings";
import { strings } from "./strings";

type IncomingMessage =
  | { type: "ready" }
  | { type: "setEnabled"; value: boolean }
  | { type: "setMode"; value: Mode }
  | { type: "updateAllImages"; patch: Partial<Rotation> }
  | { type: "updateArea"; id: AreaId; patch: Partial<AreaSettings> }
  | { type: "updateSource"; id: string; patch: Partial<ImageSource> }
  | { type: "removeSource"; id: string }
  | { type: "moveSource"; id: string; delta: number }
  | { type: "moveSourceImage"; id: string; file: string; delta: number }
  | { type: "removeSourceImage"; id: string; file: string }
  | { type: "updatePreset"; id: string; patch: Partial<Preset> }
  | { type: "addPresetImage"; id: string; ref: string }
  | { type: "movePresetImage"; id: string; index: number; delta: number }
  | { type: "removePresetImage"; id: string; index: number }
  | { type: "command"; command: string; arg?: string };

/** Commands the webview may run, and whether each one takes the clicked item's id. */
const ALLOWED_COMMANDS: Record<string, boolean> = {
  "ushiroe.addImageFile": false,
  "ushiroe.addImageFolder": false,
  "ushiroe.addImageUrl": false,
  "ushiroe.nextImage": false,
  "ushiroe.refreshImages": false,
  "ushiroe.refreshSource": true,
  "ushiroe.addImagesToSource": true,
  "ushiroe.openSourceFolder": true,
  "ushiroe.openLibrary": false,
  "ushiroe.chooseLibraryFolder": false,
  "ushiroe.resetLibraryFolder": false,
  "ushiroe.newPreset": false,
  "ushiroe.deletePreset": true,
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
const ROTATION_KEYS = ["random", "interval", "changeOnStartupOnly"] as const;
const SOURCE_PATCH_KEYS = new Set<keyof ImageSource>([
  "name",
  "description",
  "refresh",
  ...ROTATION_KEYS,
]);
const PRESET_PATCH_KEYS = new Set<keyof Preset>(["name", ...ROTATION_KEYS]);
const ROTATION_PATCH_KEYS = new Set<keyof Rotation>(ROTATION_KEYS);

/** Moves are always one step, so a forged message cannot reorder anything else. */
function step(delta: unknown): number {
  return delta === -1 || delta === 1 ? delta : 0;
}

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
      case "updateAllImages":
        await updateAllImages(pickKeys<Rotation>(message.patch, ROTATION_PATCH_KEYS));
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
      case "moveSource":
        await moveSource(message.id, step(message.delta));
        return;
      case "moveSourceImage":
        await this.library.moveImage(message.id, message.file, step(message.delta));
        return;
      case "removeSourceImage":
        await this.library.removeImage(message.id, message.file);
        return;
      case "updatePreset": {
        const patch = pickKeys<Preset>(message.patch, PRESET_PATCH_KEYS);
        await updatePreset(message.id, (preset) => ({ ...preset, ...patch }));
        return;
      }
      case "addPresetImage":
        if (typeof message.ref === "string" && this.library.resolver.fileOf(message.ref)) {
          await updatePreset(message.id, (preset) => ({
            ...preset,
            images: [...preset.images, message.ref],
          }));
        }
        return;
      case "movePresetImage":
        await updatePreset(message.id, (preset) => ({
          ...preset,
          images: moveItem(preset.images, message.index, step(message.delta)),
        }));
        return;
      case "removePresetImage":
        await updatePreset(message.id, (preset) => ({
          ...preset,
          images: preset.images.filter((_ref, index) => index !== message.index),
        }));
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
    const thumbnail = (file: string) => view.webview.asWebviewUri(Uri.file(file)).toString();
    const sources = settings.sources.map((source) => {
      const images = this.library.resolver.imagesOf(source).map((file) => {
        const name = path.basename(file);
        return { file: name, ref: imageRef(source.id, name), thumbnail: thumbnail(file) };
      });
      return { ...source, images, count: images.length, thumbnail: images[0]?.thumbnail ?? null };
    });
    const presets = settings.presets.map((preset) => ({
      ...preset,
      entries: preset.images.map((ref) => {
        const file = this.library.resolver.fileOf(ref);
        return { ref, thumbnail: file === null ? null : thumbnail(file) };
      }),
    }));
    const patch = this.patch.status;
    await view.webview.postMessage({
      type: "state",
      settings,
      sources,
      presets,
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
