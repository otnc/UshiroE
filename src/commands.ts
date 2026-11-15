import fs from "node:fs";

import { Uri, l10n, window } from "vscode";

import {
  IMAGE_EXTENSIONS,
  type ImageSource,
  type SourceType,
  createSourceId,
  DEFAULT_INTERVAL_SECONDS,
} from "./core/model";
import { defaultSourceName, normalizeSettings } from "./core/normalize";
import { isAllowedRemoteUrl } from "./core/resolve";
import { addSources, readSettings, replaceSettings, updateArea } from "./settings";
import { confirmReplaceSettings } from "./ui/prompts";

const EXPORT_FORMAT = "ushiroe-settings";

function newSource(type: SourceType, path: string): ImageSource {
  let name = defaultSourceName(path);
  if (type === "url") {
    try {
      name = defaultSourceName(new URL(path).pathname) || new URL(path).hostname;
    } catch {
      // Keep the raw value as the name.
    }
  }
  return {
    id: createSourceId(),
    name,
    type,
    path,
    description: "",
    random: false,
    interval: DEFAULT_INTERVAL_SECONDS,
    recursive: false,
  };
}

/** Adds sources and shows the first one right away when the full window has no image yet. */
async function addAndShow(sources: ImageSource[]): Promise<void> {
  if (sources.length === 0) {
    return;
  }
  await addSources(sources);
  const settings = readSettings();
  if (settings.mode === "fullscreen" && settings.areas.fullscreen.source === null) {
    await updateArea("fullscreen", { source: sources[0].id });
  }
}

export async function addImageFiles(): Promise<void> {
  const files = await window.showOpenDialog({
    canSelectMany: true,
    openLabel: l10n.t("Add Images"),
    filters: { [l10n.t("Images")]: IMAGE_EXTENSIONS.map((extension) => extension.slice(1)) },
  });
  await addAndShow((files ?? []).map((file) => newSource("file", file.fsPath)));
}

export async function addImageFolder(): Promise<void> {
  const folders = await window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: true,
    openLabel: l10n.t("Add Folder"),
  });
  await addAndShow((folders ?? []).map((folder) => newSource("folder", folder.fsPath)));
}

export async function addImageUrl(): Promise<void> {
  const url = await window.showInputBox({
    prompt: l10n.t("Image URL (https only)"),
    placeHolder: "https://example.com/wallpaper.png",
    validateInput: (value) =>
      isAllowedRemoteUrl(value.trim()) ? undefined : l10n.t("Enter an https:// URL."),
  });
  if (url) {
    await addAndShow([newSource("url", url.trim())]);
  }
}

export async function exportSettings(): Promise<void> {
  const target = await window.showSaveDialog({
    defaultUri: Uri.file("ushiroe-settings.json"),
    filters: { JSON: ["json"] },
  });
  if (!target) {
    return;
  }
  const data = { format: EXPORT_FORMAT, version: 1, settings: readSettings() };
  await fs.promises.writeFile(target.fsPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  void window.showInformationMessage(
    l10n.t("UshiroE settings were exported to {0}.", target.fsPath)
  );
}

export async function importSettings(): Promise<void> {
  const files = await window.showOpenDialog({ canSelectMany: false, filters: { JSON: ["json"] } });
  if (!files?.length) {
    return;
  }
  let data: unknown;
  try {
    data = JSON.parse(await fs.promises.readFile(files[0].fsPath, "utf8"));
  } catch (error) {
    void window.showErrorMessage(l10n.t("The file could not be read as JSON: {0}", String(error)));
    return;
  }
  const record = data as { format?: unknown; settings?: unknown } | null;
  if (
    record?.format !== EXPORT_FORMAT ||
    typeof record.settings !== "object" ||
    record.settings === null
  ) {
    void window.showErrorMessage(l10n.t("This file is not a UshiroE settings export."));
    return;
  }
  if (!(await confirmReplaceSettings(l10n.t("Replace the current UshiroE settings?")))) {
    return;
  }
  await replaceSettings(normalizeSettings(record.settings as Record<string, unknown>));
  void window.showInformationMessage(l10n.t("UshiroE settings were imported."));
}
