import {
  ALL_SOURCES,
  AREA_IDS,
  type AreaId,
  type AreaSettings,
  DEFAULT_AREAS,
  DEFAULT_INTERVAL_SECONDS,
  type ImageSource,
  MODES,
  MAX_OPACITY,
  type Mode,
  PRESET_PREFIX,
  type Preset,
  type Rotation,
  SIZES,
  type Size,
  SOURCE_TYPES,
  type SourceType,
  URL_REFRESH_MODES,
  type UrlRefresh,
  type UshiroeSettings,
  defaultSettings,
} from "./model";
import { clamp, finiteNumber, isRecord, nonEmptyString, oneOf } from "./guards";

export function defaultSourceName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const last = trimmed.split(/[\\/]/).pop() ?? trimmed;
  return last === "" ? trimmed : last;
}

/** Reads the shared rotation fields, falling back to `fallback` for missing ones. */
export function normalizeRotation(raw: unknown, fallback: Rotation): Rotation {
  const value = isRecord(raw) ? raw : {};
  return {
    random: typeof value.random === "boolean" ? value.random : fallback.random,
    interval: Math.max(0, finiteNumber(value.interval, fallback.interval)),
    changeOnStartupOnly:
      typeof value.changeOnStartupOnly === "boolean"
        ? value.changeOnStartupOnly
        : fallback.changeOnStartupOnly,
  };
}

const SOURCE_ROTATION: Rotation = {
  random: false,
  interval: DEFAULT_INTERVAL_SECONDS,
  changeOnStartupOnly: false,
};

export function normalizeSource(raw: unknown): ImageSource | null {
  const path = isRecord(raw) ? nonEmptyString(raw.path) : null;
  if (!isRecord(raw) || path === null) {
    return null;
  }
  return {
    id: nonEmptyString(raw.id) ?? path,
    name: nonEmptyString(raw.name) ?? defaultSourceName(path),
    type: oneOf<SourceType>(SOURCE_TYPES, raw.type, "file"),
    path,
    description: typeof raw.description === "string" ? raw.description.trim() : "",
    ...normalizeRotation(raw, SOURCE_ROTATION),
    recursive: raw.recursive === true,
    refresh: oneOf<UrlRefresh>(URL_REFRESH_MODES, raw.refresh, "never"),
  };
}

/** Normalizes a list and drops entries whose id was already seen. */
function uniqueById<T extends { id: string }>(
  raw: unknown,
  normalize: (item: unknown) => T | null
): T[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of raw) {
    const value = normalize(item);
    if (value && !seen.has(value.id)) {
      seen.add(value.id);
      result.push(value);
    }
  }
  return result;
}

export function normalizeSources(raw: unknown): ImageSource[] {
  return uniqueById(raw, normalizeSource);
}

export function normalizeArea(id: AreaId, raw: unknown): AreaSettings {
  const fallback = DEFAULT_AREAS[id];
  if (!isRecord(raw)) {
    return { ...fallback };
  }
  return {
    enabled:
      id === "fullscreen"
        ? true
        : typeof raw.enabled === "boolean"
          ? raw.enabled
          : fallback.enabled,
    source: nonEmptyString(raw.source),
    opacity: clamp(finiteNumber(raw.opacity, fallback.opacity), 0, MAX_OPACITY),
    size: oneOf<Size>(SIZES, raw.size, fallback.size),
    position: nonEmptyString(raw.position) ?? fallback.position,
    blur: clamp(finiteNumber(raw.blur, fallback.blur), 0, 200),
  };
}

/** Normalizes every area and clears references to sources or presets that no longer exist. */
function normalizeAreas(
  raw: Record<string, unknown>,
  sources: readonly ImageSource[],
  presets: readonly Preset[]
): Record<AreaId, AreaSettings> {
  const known = new Set([
    ALL_SOURCES,
    ...sources.map((source) => source.id),
    ...presets.map((preset) => PRESET_PREFIX + preset.id),
  ]);
  const areas = {} as Record<AreaId, AreaSettings>;
  for (const id of AREA_IDS) {
    const area = normalizeArea(id, raw[id]);
    if (area.source !== null && !known.has(area.source)) {
      area.source = null;
    }
    areas[id] = area;
  }
  return areas;
}

const PRESET_ROTATION: Rotation = { random: false, interval: 60, changeOnStartupOnly: false };

/** A preset image reference: `<source id>/<file name>`. */
export function parseImageRef(ref: string): { sourceId: string; file: string } | null {
  const slash = ref.lastIndexOf("/");
  if (slash <= 0 || slash === ref.length - 1) {
    return null;
  }
  return { sourceId: ref.slice(0, slash), file: ref.slice(slash + 1) };
}

export function normalizePreset(raw: unknown): Preset | null {
  const name = isRecord(raw) ? nonEmptyString(raw.name) : null;
  if (!isRecord(raw) || name === null) {
    return null;
  }
  const images = Array.isArray(raw.images)
    ? raw.images.filter(
        (ref): ref is string => typeof ref === "string" && parseImageRef(ref) !== null
      )
    : [];
  return {
    id: nonEmptyString(raw.id) ?? name,
    name,
    images,
    ...normalizeRotation(raw, PRESET_ROTATION),
  };
}

/** Builds settings from loosely typed values such as `settings.json` or an imported file. */
export function normalizeSettings(
  raw: Partial<Record<keyof UshiroeSettings | AreaId, unknown>>
): UshiroeSettings {
  const settings = defaultSettings();
  settings.enabled = raw.enabled === true;
  settings.mode = oneOf<Mode>(MODES, raw.mode, "fullscreen");
  settings.sources = normalizeSources(raw.sources);
  settings.presets = uniqueById(raw.presets, normalizePreset);
  settings.areas = normalizeAreas(
    isRecord(raw.areas) ? raw.areas : raw,
    settings.sources,
    settings.presets
  );
  settings.transition = clamp(finiteNumber(raw.transition, settings.transition), 0, 30);
  settings.allImages = normalizeRotation(raw.allImages, settings.allImages);
  return settings;
}

/** The shape stored in `settings.json` for one area; fullscreen has no `enabled` flag. */
export function areaToConfigValue(id: AreaId, area: AreaSettings): Record<string, unknown> {
  const { enabled, ...rest } = area;
  return id === "fullscreen" ? rest : { enabled, ...rest };
}

/** The `settings.json` shape of a source; `refresh` only matters for URLs. */
export function sourceToConfigValue(source: ImageSource): Record<string, unknown> {
  const { refresh, ...rest } = source;
  return source.type === "url" ? { ...rest, refresh } : rest;
}
