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

/** Area `source` value that shows the images of every source, in the source list's order. */
export const ALL_SOURCES = "*";

/** Area `source` values that point at a preset start with this. */
export const PRESET_PREFIX = "preset:";

export const DEFAULT_INTERVAL_SECONDS = 10;

/** Highest allowed image opacity. Above this the image hides the UI, including the controls to lower it again. */
export const MAX_OPACITY = 0.8;

/** Raising a visible area above this opacity asks the user to keep it, and reverts it when they do not answer. */
export const CONFIRM_OPACITY = 0.5;

/** Image rotation settings shared by sources, presets, and the All images option. */
export interface Rotation {
  /** Pick the next image at random instead of in order. */
  random: boolean;
  /** Seconds between images; 0 disables timed rotation. */
  interval: number;
  /** Change the image only when VS Code starts, never while it runs. */
  changeOnStartupOnly: boolean;
}

export interface ImageSource extends Rotation {
  id: string;
  name: string;
  type: SourceType;
  /** Where the images were imported from, or the URL for `url` sources. */
  path: string;
  description: string;
  recursive: boolean;
  /** Only used by `url` sources. */
  refresh: UrlRefresh;
}

export interface AreaSettings {
  /** Ignored for the fullscreen area, which is controlled by the mode instead. */
  enabled: boolean;
  /** A source id, {@link ALL_SOURCES}, {@link PRESET_PREFIX} + a preset id, or null. */
  source: string | null;
  /** How strongly the image shows through, from 0 (invisible) to {@link MAX_OPACITY}. */
  opacity: number;
  size: Size;
  position: string;
  /** Blur radius in pixels. */
  blur: number;
}

/**
 * A named, ordered list of images picked from the sources. Each image is referenced as `<source id>/<file name>` in the image folder.
 */
export interface Preset extends Rotation {
  id: string;
  name: string;
  images: string[];
}

export interface UshiroeSettings {
  enabled: boolean;
  mode: Mode;
  sources: ImageSource[];
  areas: Record<AreaId, AreaSettings>;
  /** Crossfade duration in seconds. */
  transition: number;
  /** Rotation settings for {@link ALL_SOURCES}. */
  allImages: Rotation;
  presets: Preset[];
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
    allImages: { random: true, interval: 60, changeOnStartupOnly: false },
    presets: [],
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
