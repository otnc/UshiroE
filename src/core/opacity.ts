import { AREA_IDS, type AreaId, CONFIRM_OPACITY, type UshiroeSettings, activeAreas } from "./model";

export type AreaOpacities = Record<AreaId, number>;

/** The opacity each area is drawn with; an area that draws nothing counts as 0. */
export function visibleOpacities(settings: UshiroeSettings): AreaOpacities {
  const active = new Set(activeAreas(settings));
  return Object.fromEntries(
    AREA_IDS.map((id) => [id, active.has(id) ? settings.areas[id].opacity : 0])
  ) as AreaOpacities;
}

/** Areas that became more opaque and now exceed {@link CONFIRM_OPACITY}. */
export function riskyIncreases(before: AreaOpacities, after: AreaOpacities): AreaId[] {
  return AREA_IDS.filter((id) => after[id] > CONFIRM_OPACITY && after[id] > before[id]);
}

/** The opacity to go back to: the previous value, but never above {@link CONFIRM_OPACITY}. */
export function revertOpacity(previous: number): number {
  return Math.min(previous, CONFIRM_OPACITY);
}
