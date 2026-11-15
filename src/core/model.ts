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

/** File extensions that VS Code's `vscode-file:` protocol serves from any directory. */
export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp"] as const;

export const DEFAULT_INTERVAL_SECONDS = 10;

export interface ImageSource {
  id: string;
  name: string;
  type: SourceType;
  path: string;
  description: string;
  random: boolean;
  /** Seconds between image changes for folder sources; 0 keeps the first image. */
  interval: number;
  recursive: boolean;
}

export interface AreaSettings {
  /** Ignored for the fullscreen area, which is controlled by the mode instead. */
  enabled: boolean;
  source: string | null;
  /** How strongly the image shows through, from 0 (invisible) to 1 (opaque). */
  opacity: number;
  size: Size;
  position: string;
  /** Blur radius in pixels. */
  blur: number;
}

export interface UshiroeSettings {
  enabled: boolean;
  mode: Mode;
  sources: ImageSource[];
  areas: Record<AreaId, AreaSettings>;
  /** Seconds the cross-fade between rotating images takes. */
  transition: number;
}

export const DEFAULT_AREAS: Readonly<Record<AreaId, Readonly<AreaSettings>>> = {
  fullscreen: {
    enabled: true,
    source: null,
    opacity: 0.15,
    size: "cover",
    position: "center",
    blur: 0,
  },
  editor: {
    enabled: false,
    source: null,
    opacity: 0.15,
    size: "cover",
    position: "center",
    blur: 0,
  },
  sidebar: {
    enabled: false,
    source: null,
    opacity: 0.2,
    size: "cover",
    position: "center",
    blur: 0,
  },
  auxiliaryBar: {
    enabled: false,
    source: null,
    opacity: 0.2,
    size: "cover",
    position: "center",
    blur: 0,
  },
  panel: { enabled: false, source: null, opacity: 0.2, size: "cover", position: "center", blur: 0 },
};

export function defaultSettings(): UshiroeSettings {
  return {
    enabled: false,
    mode: "fullscreen",
    sources: [],
    areas: {
      fullscreen: { ...DEFAULT_AREAS.fullscreen },
      editor: { ...DEFAULT_AREAS.editor },
      sidebar: { ...DEFAULT_AREAS.sidebar },
      auxiliaryBar: { ...DEFAULT_AREAS.auxiliaryBar },
      panel: { ...DEFAULT_AREAS.panel },
    },
    transition: 1,
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

export function createSourceId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
