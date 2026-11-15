import { type Preset, createId } from "./model";

/** The reference a preset stores for an image in the image folder. */
export function imageRef(sourceId: string, file: string): string {
  return `${sourceId}/${file}`;
}

export function createPreset(name: string): Preset {
  return {
    id: createId(),
    name,
    images: [],
    random: false,
    interval: 60,
    changeOnStartupOnly: false,
  };
}

/**
 * Moves the item at `index` by `delta` places, clamped to the list. Returns a new list, or the same list when nothing moves.
 */
export function moveItem<T>(list: readonly T[], index: number, delta: number): T[] {
  const target = Math.min(list.length - 1, Math.max(0, index + delta));
  if (index < 0 || index >= list.length || target === index) {
    return [...list];
  }
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

/** Drops images whose source no longer exists, for example after a source was removed. */
export function withoutSources(preset: Preset, removedSourceId: string): Preset {
  return {
    ...preset,
    images: preset.images.filter((ref) => !ref.startsWith(`${removedSourceId}/`)),
  };
}
