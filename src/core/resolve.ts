import { toWorkbenchUrl, MAX_FOLDER_IMAGES } from "./files";
import { EMPTY_LIVE_CONFIG, LIVE_CONFIG_VERSION, type LiveArea, type LiveConfig } from "./live";
import { ALL_SOURCES, type ImageSource, type UshiroeSettings, activeAreas } from "./model";

/** The local image files to show for a source, in order. */
export type ImageLookup = (source: ImageSource) => string[];

interface Playlist {
  images: string[];
  random: boolean;
  /** Milliseconds between images. */
  interval: number;
}

function playlistFor(
  sourceId: string,
  settings: UshiroeSettings,
  imagesOf: ImageLookup
): Playlist | null {
  if (sourceId === ALL_SOURCES) {
    const images = [...new Set(settings.sources.flatMap(imagesOf))].slice(0, MAX_FOLDER_IMAGES);
    return { images, random: true, interval: Math.round(settings.shuffleInterval * 1000) };
  }
  const source = settings.sources.find((candidate) => candidate.id === sourceId);
  return source
    ? {
        images: imagesOf(source),
        random: source.random,
        interval: Math.round(source.interval * 1000),
      }
    : null;
}

export function buildLiveConfig(
  settings: UshiroeSettings,
  cycle: number,
  imagesOf: ImageLookup
): LiveConfig {
  if (!settings.enabled) {
    return { ...EMPTY_LIVE_CONFIG, transition: settings.transition, cycle };
  }
  const areas: LiveArea[] = [];
  for (const id of activeAreas(settings)) {
    const area = settings.areas[id];
    const playlist = area.source === null ? null : playlistFor(area.source, settings, imagesOf);
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
      interval: playlist.interval,
    });
  }
  return { v: LIVE_CONFIG_VERSION, enabled: true, transition: settings.transition, areas, cycle };
}
