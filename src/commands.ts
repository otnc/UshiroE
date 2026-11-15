import fs from "node:fs";

import { Uri, l10n, window } from "vscode";

import { isDownloadableUrl } from "./core/downloads";
import { hasImagesInSubfolders } from "./core/files";
import {
  DEFAULT_INTERVAL_SECONDS,
  IMAGE_EXTENSIONS,
  type ImageSource,
  type SourceType,
  type UrlRefresh,
  createId,
} from "./core/model";
import { defaultSourceName, normalizeSettings } from "./core/normalize";
import type { LibraryManager } from "./libraryManager";
import { addSources, readSettings, replaceSettings, updateArea } from "./settings";
import { confirmReplaceSettings } from "./ui/prompts";

const EXPORT_FORMAT = "ushiroe-settings";

function newSource(type: SourceType, path: string, refresh: UrlRefresh = "never"): ImageSource {
  let name = defaultSourceName(path);
  if (type === "url") {
    try {
      const url = new URL(path);
      name = defaultSourceName(url.pathname) || url.hostname;
    } catch {
      // Keep the raw value as the name.
    }
  }
  return {
    id: createId(),
    name,
    type,
    path,
    description: "",
    random: false,
    interval: DEFAULT_INTERVAL_SECONDS,
    recursive: false,
    changeOnStartupOnly: false,
    refresh,
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
  if (!folders?.length) {
    return;
  }
  // The folder is copied once, so subfolders can only be included now.
  let recursive = false;
  const nested = await Promise.all(
    folders.map((folder) => hasImagesInSubfolders(folder.fsPath).catch(() => false))
  );
  if (nested.some(Boolean)) {
    const include = l10n.t("Include Subfolders");
    const choice = await window.showQuickPick([include, l10n.t("Only This Folder")], {
      placeHolder: l10n.t("The folder has images in subfolders too. Copy them as well?"),
    });
    if (choice === undefined) {
      return;
    }
    recursive = choice === include;
  }
  await addAndShow(folders.map((folder) => ({ ...newSource("folder", folder.fsPath), recursive })));
}

export async function addImageUrl(library: LibraryManager): Promise<void> {
  const url = (
    await window.showInputBox({
      prompt: l10n.t("Image URL"),
      placeHolder: "https://example.com/wallpaper.png",
      validateInput: (value) =>
        isDownloadableUrl(value.trim()) ? undefined : l10n.t("Enter an http:// or https:// URL."),
    })
  )?.trim();
  if (!url) {
    return;
  }
  const refresh = await window.showQuickPick(
    [
      {
        label: l10n.t("Download once"),
        detail: l10n.t("Keep a copy in the UshiroE folder. Use Download Again to update it."),
        value: "never" as const,
      },
      {
        label: l10n.t("Download at every startup"),
        detail: l10n.t(
          "Fetch the image again each time VS Code starts, so changes at the URL show up."
        ),
        value: "startup" as const,
      },
    ],
    { placeHolder: l10n.t("When should UshiroE download this image?") }
  );
  if (!refresh) {
    return;
  }
  const source = newSource("url", url, refresh.value);
  // Downloading before adding reports a bad URL right away instead of adding a broken source.
  await library.sync([source], { refreshUrls: () => true, visible: true });
  if (library.resolver.imagesOf(source).length > 0) {
    await addAndShow([source]);
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
