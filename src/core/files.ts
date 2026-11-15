import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { IMAGE_EXTENSIONS } from "./model";

/** Upper bound per source, so a huge photo library cannot bloat the live config. */
export const MAX_FOLDER_IMAGES = 2000;

export function isSupportedImage(filePath: string): boolean {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(path.extname(filePath).toLowerCase());
}

/** Converts a local path to the `vscode-file://vscode-app/...` URL that the workbench can load. */
export function toWorkbenchUrl(filePath: string): string {
  return pathToFileURL(filePath).href.replace(/^file:\/\//, "vscode-file://vscode-app");
}

const naturalOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export async function listFolderImages(folder: string, recursive: boolean): Promise<string[]> {
  const entries = await fs.promises.readdir(folder, { withFileTypes: true, recursive });
  return entries
    .filter((entry) => entry.isFile() && isSupportedImage(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort((a, b) => naturalOrder.compare(a, b))
    .slice(0, MAX_FOLDER_IMAGES);
}
