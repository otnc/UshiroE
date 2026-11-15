import {
    AREA_IDS,
    type AreaId,
    type AreaSettings,
    DEFAULT_AREAS,
    DEFAULT_INTERVAL_SECONDS,
    type ImageSource,
    MODES,
    type Mode,
    SIZES,
    type Size,
    SOURCE_TYPES,
    type SourceType,
    type UshiroeSettings,
    defaultSettings,
} from "./model";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function oneOf<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
    return list.includes(value as T) ? (value as T) : fallback;
}

export function normalizeSource(raw: unknown): ImageSource | null {
    if (!isRecord(raw) || typeof raw.path !== "string" || raw.path.trim() === "") {
        return null;
    }
    const type = oneOf<SourceType>(SOURCE_TYPES, raw.type, "file");
    const path = raw.path.trim();
    const id = typeof raw.id === "string" && raw.id !== "" ? raw.id : path;
    return {
        id,
        name: typeof raw.name === "string" && raw.name.trim() !== "" ? raw.name.trim() : defaultSourceName(path),
        type,
        path,
        description: typeof raw.description === "string" ? raw.description.trim() : "",
        random: raw.random === true,
        interval: Math.max(0, finiteNumber(raw.interval, DEFAULT_INTERVAL_SECONDS)),
        recursive: raw.recursive === true,
    };
}

export function defaultSourceName(path: string): string {
    const trimmed = path.replace(/[\\/]+$/, "");
    const last = trimmed.split(/[\\/]/).pop() ?? trimmed;
    return last === "" ? trimmed : last;
}

export function normalizeSources(raw: unknown): ImageSource[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const seen = new Set<string>();
    const result: ImageSource[] = [];
    for (const item of raw) {
        const source = normalizeSource(item);
        if (source && !seen.has(source.id)) {
            seen.add(source.id);
            result.push(source);
        }
    }
    return result;
}

export function normalizeArea(id: AreaId, raw: unknown): AreaSettings {
    const fallback = DEFAULT_AREAS[id];
    if (!isRecord(raw)) {
        return { ...fallback };
    }
    return {
        enabled: id === "fullscreen" ? true : typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
        source: typeof raw.source === "string" && raw.source !== "" ? raw.source : null,
        opacity: clamp(finiteNumber(raw.opacity, fallback.opacity), 0, 1),
        size: oneOf<Size>(SIZES, raw.size, fallback.size),
        position: typeof raw.position === "string" && raw.position.trim() !== "" ? raw.position.trim() : fallback.position,
        blur: clamp(finiteNumber(raw.blur, fallback.blur), 0, 200),
    };
}

/** Builds settings from loosely typed values such as `settings.json` or an imported file. */
export function normalizeSettings(raw: Partial<Record<keyof UshiroeSettings | AreaId, unknown>>): UshiroeSettings {
    const settings = defaultSettings();
    settings.enabled = raw.enabled === true;
    settings.mode = oneOf<Mode>(MODES, raw.mode, "fullscreen");
    settings.sources = normalizeSources(raw.sources);
    const areas = isRecord(raw.areas) ? raw.areas : raw;
    for (const id of AREA_IDS) {
        settings.areas[id] = normalizeArea(id, areas[id]);
    }
    settings.transition = clamp(finiteNumber(raw.transition, settings.transition), 0, 30);

    const known = new Set(settings.sources.map((source) => source.id));
    for (const id of AREA_IDS) {
        const area = settings.areas[id];
        if (area.source !== null && !known.has(area.source)) {
            area.source = null;
        }
    }
    return settings;
}

/** The shape stored in `settings.json` for one area; fullscreen has no `enabled` flag. */
export function areaToConfigValue(id: AreaId, area: AreaSettings): Record<string, unknown> {
    const { enabled, ...rest } = area;
    return id === "fullscreen" ? rest : { enabled, ...rest };
}
