import {
  AREA_IDS,
  type AreaId,
  type AreaSettings,
  type Preset,
  type UshiroeSettings,
  createId,
} from "./model";

function copyAreas(areas: Record<AreaId, AreaSettings>): Record<AreaId, AreaSettings> {
  return Object.fromEntries(AREA_IDS.map((id) => [id, { ...areas[id] }])) as Record<
    AreaId,
    AreaSettings
  >;
}

export function presetFromSettings(name: string, settings: UshiroeSettings): Preset {
  return { id: createId(), name, mode: settings.mode, areas: copyAreas(settings.areas) };
}

/** True when the settings currently show exactly what the preset describes. */
export function matchesPreset(preset: Preset, settings: UshiroeSettings): boolean {
  return (
    preset.mode === settings.mode &&
    AREA_IDS.every((id) => JSON.stringify(preset.areas[id]) === JSON.stringify(settings.areas[id]))
  );
}

/**
 * Picks a preset at random, avoiding the one that is currently shown when there is a choice,
 * so "random" always visibly changes something.
 */
export function pickRandomPreset(
  settings: UshiroeSettings,
  random: () => number = Math.random
): Preset | null {
  const others = settings.presets.filter((preset) => !matchesPreset(preset, settings));
  const pool = others.length > 0 ? others : settings.presets;
  return pool.length === 0 ? null : pool[Math.floor(random() * pool.length)];
}
