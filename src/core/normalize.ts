import {
  ALL_SOURCES,
  AREA_IDS,
  type AreaId,
  type AreaSettings,
  DEFAULT_AREAS,
  DEFAULT_INTERVAL_SECONDS,
  type ImageSource,
  MODES,
  type Mode,
  type Preset,
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
    random: raw.random === true,
    interval: Math.max(0, finiteNumber(raw.interval, DEFAULT_INTERVAL_SECONDS)),
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
    opacity: clamp(finiteNumber(raw.opacity, fallback.opacity), 0, 1),
    size: oneOf<Size>(SIZES, raw.size, fallback.size),
    position: nonEmptyString(raw.position) ?? fallback.position,
    blur: clamp(finiteNumber(raw.blur, fallback.blur), 0, 200),
  };
}

/** Normalizes every area and clears references to sources that no longer exist. */
function normalizeAreas(
  raw: Record<string, unknown>,
  sources: readonly ImageSource[]
): Record<AreaId, AreaSettings> {
  const known = new Set([ALL_SOURCES, ...sources.map((source) => source.id)]);
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

export function normalizePreset(raw: unknown, sources: readonly ImageSource[]): Preset | null {
  const name = isRecord(raw) ? nonEmptyString(raw.name) : null;
  if (!isRecord(raw) || name === null) {
    return null;
  }
  return {
    id: nonEmptyString(raw.id) ?? name,
    name,
    mode: oneOf<Mode>(MODES, raw.mode, "fullscreen"),
    areas: normalizeAreas(isRecord(raw.areas) ? raw.areas : {}, sources),
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
  settings.areas = normalizeAreas(isRecord(raw.areas) ? raw.areas : raw, settings.sources);
  settings.transition = clamp(finiteNumber(raw.transition, settings.transition), 0, 30);
  settings.shuffleInterval = Math.max(
    0,
    finiteNumber(raw.shuffleInterval, settings.shuffleInterval)
  );
  settings.presets = uniqueById(raw.presets, (item) => normalizePreset(item, settings.sources));
  settings.randomPresetOnStartup = raw.randomPresetOnStartup === true;
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
