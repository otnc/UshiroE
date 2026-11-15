import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { EMPTY_LIVE_CONFIG, LIVE_CONFIG_VERSION, type LiveArea, type LiveConfig } from "./live";
import { IMAGE_EXTENSIONS, type ImageSource, type UshiroeSettings, activeAreas } from "./model";

/** Upper bound per folder, so a huge photo library cannot bloat the live config. */
export const MAX_FOLDER_IMAGES = 2000;

export function isSupportedImage(filePath: string): boolean {
    return (IMAGE_EXTENSIONS as readonly string[]).includes(path.extname(filePath).toLowerCase());
}

/** The workbench CSP only allows `https:` for remote images. */
export function isAllowedRemoteUrl(value: string): boolean {
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
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

/** Local paths or https URLs for one source; missing files resolve to an empty list. */
export async function resolveSourceImages(source: ImageSource): Promise<string[]> {
    try {
        switch (source.type) {
            case "url":
                return isAllowedRemoteUrl(source.path) ? [source.path] : [];
            case "file": {
                const stat = await fs.promises.stat(source.path);
                return stat.isFile() && isSupportedImage(source.path) ? [source.path] : [];
            }
            case "folder":
                return await listFolderImages(source.path, source.recursive);
        }
    } catch {
        return [];
    }
}

function toLoadableUrl(image: string): string {
    return isAllowedRemoteUrl(image) ? image : toWorkbenchUrl(image);
}

export async function buildLiveConfig(settings: UshiroeSettings, cycle: number): Promise<LiveConfig> {
    if (!settings.enabled) {
        return { ...EMPTY_LIVE_CONFIG, transition: settings.transition, cycle };
    }
    const sources = new Map(settings.sources.map((source) => [source.id, source]));
    const areas: LiveArea[] = [];
    for (const id of activeAreas(settings)) {
        const area = settings.areas[id];
        const source = area.source === null ? undefined : sources.get(area.source);
        if (!source) {
            continue;
        }
        const images = await resolveSourceImages(source);
        if (images.length === 0) {
            continue;
        }
        areas.push({
            id,
            images: images.map(toLoadableUrl),
            opacity: area.opacity,
            size: area.size,
            position: area.position,
            blur: area.blur,
            random: source.random,
            interval: Math.round(source.interval * 1000),
        });
    }
    return { v: LIVE_CONFIG_VERSION, enabled: true, transition: settings.transition, areas, cycle };
}
