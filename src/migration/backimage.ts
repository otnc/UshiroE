import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_INTERVAL_SECONDS,
  type ImageSource,
  type PartId,
  type UshiroeSettings,
  defaultSettings,
} from "../core/model";
import { clamp, finiteNumber, isRecord, nonEmptyString } from "../core/guards";
import { defaultSourceName } from "../core/normalize";

export const BACKIMAGE_EXTENSION_ID = "ROBOTofficial.backimage";

/** The `globalState` object BackImage 1.x stores under its extension id. */
interface BackImageState {
  imageLists?: unknown;
  elementsRandom?: unknown;
  elementsInterval?: unknown;
  elementsOpacity?: unknown;
  backgroundImg?: unknown;
  backgroundType?: unknown;
  enable?: unknown;
}

const PART_NAMES: Record<string, PartId> = {
  editor: "editor",
  panel: "panel",
  "side-bar": "sidebar",
};

function clampOpacity(value: number): number {
  return clamp(value, 0, 1);
}

/**
 * Converts BackImage's stored state to UshiroE settings.
 *
 * BackImage's fullscreen opacity is the opacity of the whole UI drawn over the image, while
 * UshiroE stores how visible the image is, so that value is inverted. Part opacities already
 * describe the image. Intervals move from milliseconds to seconds.
 */
export function convertBackImageState(raw: unknown): UshiroeSettings | null {
  if (!isRecord(raw)) {
    return null;
  }
  const state = raw as BackImageState;
  const settings = defaultSettings();

  const randoms = isRecord(state.elementsRandom) ? state.elementsRandom : {};
  const intervals = isRecord(state.elementsInterval) ? state.elementsInterval : {};
  const lists = Array.isArray(state.imageLists) ? state.imageLists : [];
  for (const item of lists) {
    const itemPath = isRecord(item) ? nonEmptyString(item.path) : null;
    if (!isRecord(item) || itemPath === null) {
      continue;
    }
    const id = nonEmptyString(item.id) ?? itemPath;
    const source: ImageSource = {
      id,
      name: nonEmptyString(item.name) ?? defaultSourceName(itemPath),
      type: item.type === "folder" ? "folder" : "file",
      path: itemPath,
      description: typeof item.description === "string" ? item.description : "",
      random: randoms[id] === true,
      interval: Math.max(0, finiteNumber(intervals[id], DEFAULT_INTERVAL_SECONDS * 1000) / 1000),
      recursive: false,
      refresh: "never",
    };
    if (!settings.sources.some((existing) => existing.id === source.id)) {
      settings.sources.push(source);
    }
  }

  const known = new Set(settings.sources.map((source) => source.id));
  const pick = (value: unknown) => (typeof value === "string" && known.has(value) ? value : null);
  const images = isRecord(state.backgroundImg) ? state.backgroundImg : {};
  settings.areas.fullscreen.source = pick(images.fullscreen);
  settings.areas.editor.source = pick(images.editor);
  settings.areas.panel.source = pick(images.panel);
  settings.areas.sidebar.source = pick(images.sideBar);

  if (isRecord(state.elementsOpacity)) {
    const opacity = state.elementsOpacity;
    settings.areas.fullscreen.opacity = clampOpacity(1 - finiteNumber(opacity.fullscreen, 0.85));
    settings.areas.editor.opacity = clampOpacity(
      finiteNumber(opacity.editor, settings.areas.editor.opacity)
    );
    settings.areas.panel.opacity = clampOpacity(
      finiteNumber(opacity.panel, settings.areas.panel.opacity)
    );
    settings.areas.sidebar.opacity = clampOpacity(
      finiteNumber(opacity.sideBar, settings.areas.sidebar.opacity)
    );
  }

  const type = state.backgroundType;
  if (Array.isArray(type)) {
    settings.mode = "parts";
    for (const name of type) {
      const part = typeof name === "string" ? PART_NAMES[name] : undefined;
      if (part) {
        settings.areas[part].enabled = true;
      }
    }
  } else {
    settings.mode = "fullscreen";
  }
  // BackImage only drew something when it was enabled and a background type was chosen.
  settings.enabled = state.enable === true && (type === "fullscreen" || Array.isArray(type));
  return settings;
}

export interface StateDatabase {
  /** Human-readable label such as "Default profile". */
  label: string;
  file: string;
}

/**
 * `state.vscdb` files that can hold BackImage's state: the default profile's and every
 * custom profile's. `globalStorageDir` is `<user data>/User/globalStorage`.
 */
export function findStateDatabases(globalStorageDir: string): StateDatabase[] {
  const result: StateDatabase[] = [];
  const defaultDb = path.join(globalStorageDir, "state.vscdb");
  if (fs.existsSync(defaultDb)) {
    result.push({ label: "default", file: defaultDb });
  }
  const profilesDir = path.join(path.dirname(globalStorageDir), "profiles");
  try {
    for (const entry of fs.readdirSync(profilesDir, { withFileTypes: true })) {
      const file = path.join(profilesDir, entry.name, "globalStorage", "state.vscdb");
      if (entry.isDirectory() && fs.existsSync(file)) {
        result.push({ label: entry.name, file });
      }
    }
  } catch {
    // No custom profiles.
  }
  return result;
}

/**
 * Reads BackImage's JSON state from a VS Code state database. The file is read into memory
 * first, so the database VS Code keeps open is never locked or modified.
 */
export async function readBackImageState(
  databaseFile: string,
  wasmFile: string
): Promise<unknown | null> {
  const { default: initSqlJs } = await import("sql.js");
  const SQL = await initSqlJs({ locateFile: () => wasmFile });
  const db = new SQL.Database(await fs.promises.readFile(databaseFile));
  try {
    const statement = db.prepare("SELECT value FROM ItemTable WHERE lower(key) = lower(?) LIMIT 1");
    try {
      statement.bind([BACKIMAGE_EXTENSION_ID]);
      if (!statement.step()) {
        return null;
      }
      const [value] = statement.get();
      const text =
        typeof value === "string"
          ? value
          : value instanceof Uint8Array
            ? new TextDecoder().decode(value)
            : null;
      return text === null ? null : JSON.parse(text);
    } finally {
      statement.free();
    }
  } finally {
    db.close();
  }
}
