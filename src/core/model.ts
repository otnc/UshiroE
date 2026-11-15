export const AREA_IDS = ["fullscreen", "editor", "sidebar", "auxiliaryBar", "panel"] as const;
export type AreaId = (typeof AREA_IDS)[number];

export const PART_IDS = [
  "editor",
  "sidebar",
  "auxiliaryBar",
  "panel",
] as const satisfies readonly AreaId[];
export type PartId = (typeof PART_IDS)[number];

export const MODES = ["fullscreen", "parts"] as const;
export type Mode = (typeof MODES)[number];

export const SIZES = ["cover", "contain", "auto", "stretch", "tile"] as const;
export type Size = (typeof SIZES)[number];

export const SOURCE_TYPES = ["file", "folder", "url"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** When a URL source is downloaded: once when added, or again at every startup. */
export const URL_REFRESH_MODES = ["never", "startup"] as const;
export type UrlRefresh = (typeof URL_REFRESH_MODES)[number];

/** File extensions that VS Code's `vscode-file:` protocol serves from any directory. */
export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp"] as const;

/** Area `source` value that pools the images of every source in random order. */
export const ALL_SOURCES = "*";

export const DEFAULT_INTERVAL_SECONDS = 10;

export interface ImageSource {
  id: string;
  name: string;
  type: SourceType;
  /** File path, folder path, or URL for `url` sources. */
  path: string;
  description: string;
  random: boolean;
  /** Seconds between image changes for folder sources; 0 keeps the first image. */
  interval: number;
  recursive: boolean;
  /** Only used by `url` sources. */
  refresh: UrlRefresh;
}

export interface AreaSettings {
  /** Ignored for the fullscreen area, which is controlled by the mode instead. */
  enabled: boolean;
  /** A source id, {@link ALL_SOURCES}, or null for no image. */
  source: string | null;
  /** How strongly the image shows through, from 0 (invisible) to 1 (opaque). */
  opacity: number;
  size: Size;
  position: string;
  /** Blur radius in pixels. */
  blur: number;
}

/** A named layout: the mode and every area, without the image sources themselves. */
export interface Preset {
  id: string;
  name: string;
  mode: Mode;
  areas: Record<AreaId, AreaSettings>;
}

export interface UshiroeSettings {
  enabled: boolean;
  mode: Mode;
  sources: ImageSource[];
  areas: Record<AreaId, AreaSettings>;
  /** Seconds the cross-fade between rotating images takes. */
  transition: number;
  /** Seconds between images when an area shows {@link ALL_SOURCES}; 0 changes only at startup. */
  shuffleInterval: number;
  presets: Preset[];
  /** Apply a random preset each time VS Code starts. */
  randomPresetOnStartup: boolean;
}

const BASE_AREA: Readonly<AreaSettings> = {
  enabled: false,
  source: null,
  opacity: 0.2,
  size: "cover",
  position: "center",
  blur: 0,
};

export const DEFAULT_AREAS: Readonly<Record<AreaId, Readonly<AreaSettings>>> = {
  fullscreen: { ...BASE_AREA, enabled: true, opacity: 0.15 },
  editor: { ...BASE_AREA, opacity: 0.15 },
  sidebar: BASE_AREA,
  auxiliaryBar: BASE_AREA,
  panel: BASE_AREA,
};

export function defaultAreas(): Record<AreaId, AreaSettings> {
  return Object.fromEntries(AREA_IDS.map((id) => [id, { ...DEFAULT_AREAS[id] }])) as Record<
    AreaId,
    AreaSettings
  >;
}

export function defaultSettings(): UshiroeSettings {
  return {
    enabled: false,
    mode: "fullscreen",
    sources: [],
    areas: defaultAreas(),
    transition: 1,
    shuffleInterval: 60,
    presets: [],
    randomPresetOnStartup: false,
  };
}

/** The areas that actually render an image under the given settings. */
export function activeAreas(settings: UshiroeSettings): AreaId[] {
  if (!settings.enabled) {
    return [];
  }
  const candidates: AreaId[] =
    settings.mode === "fullscreen"
      ? ["fullscreen"]
      : PART_IDS.filter((id) => settings.areas[id].enabled);
  return candidates.filter((id) => settings.areas[id].source !== null);
}

export function createId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
