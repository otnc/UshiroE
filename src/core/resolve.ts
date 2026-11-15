import { MAX_FOLDER_IMAGES, toWorkbenchUrl } from "./files";
import { EMPTY_LIVE_CONFIG, LIVE_CONFIG_VERSION, type LiveArea, type LiveConfig } from "./live";
import {
  ALL_SOURCES,
  type ImageSource,
  PRESET_PREFIX,
  type Rotation,
  type UshiroeSettings,
  activeAreas,
} from "./model";

export interface ImageResolver {
  /** The image files of a source, in the source's order. */
  imagesOf(source: ImageSource): string[];
  /** The file a preset image reference (`<source id>/<file name>`) points at, or null. */
  fileOf(ref: string): string | null;
}

interface Playlist extends Rotation {
  images: string[];
}

/** Finds what an area's `source` value shows: a source, a preset, or all images. */
export function playlistFor(
  value: string,
  settings: UshiroeSettings,
  resolver: ImageResolver
): Playlist | null {
  if (value === ALL_SOURCES) {
    // The source list's order, and each source's own order, define the order of all images.
    const images = [...new Set(settings.sources.flatMap((source) => resolver.imagesOf(source)))];
    return { ...settings.allImages, images: images.slice(0, MAX_FOLDER_IMAGES) };
  }
  if (value.startsWith(PRESET_PREFIX)) {
    const preset = settings.presets.find((candidate) => PRESET_PREFIX + candidate.id === value);
    if (!preset) {
      return null;
    }
    const images = preset.images
      .map((ref) => resolver.fileOf(ref))
      .filter((file): file is string => file !== null);
    return { ...preset, images };
  }
  const source = settings.sources.find((candidate) => candidate.id === value);
  return source ? { ...source, images: resolver.imagesOf(source) } : null;
}

export function buildLiveConfig(
  settings: UshiroeSettings,
  cycle: number,
  resolver: ImageResolver
): LiveConfig {
  if (!settings.enabled) {
    return { ...EMPTY_LIVE_CONFIG, transition: settings.transition, cycle };
  }
  const areas: LiveArea[] = [];
  for (const id of activeAreas(settings)) {
    const area = settings.areas[id];
    const playlist = area.source === null ? null : playlistFor(area.source, settings, resolver);
    if (!playlist || playlist.images.length === 0) {
      continue;
    }
    areas.push({
      id,
      images: playlist.images.map(toWorkbenchUrl),
      opacity: area.opacity,
      size: area.size,
      position: area.position,
      blur: area.blur,
      random: playlist.random,
      interval: playlist.changeOnStartupOnly ? 0 : Math.round(playlist.interval * 1000),
      changeOnStartupOnly: playlist.changeOnStartupOnly,
    });
  }
  return { v: LIVE_CONFIG_VERSION, enabled: true, transition: settings.transition, areas, cycle };
}
