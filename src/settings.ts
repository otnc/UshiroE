import { ConfigurationTarget, workspace } from "vscode";

import {
  AREA_IDS,
  type AreaId,
  type AreaSettings,
  type ImageSource,
  type Mode,
  type UshiroeSettings,
} from "./core/model";
import { areaToConfigValue, normalizeSettings } from "./core/normalize";

export const SECTION = "ushiroe";

function config() {
  return workspace.getConfiguration(SECTION);
}

export function readSettings(): UshiroeSettings {
  const current = config();
  return normalizeSettings({
    enabled: current.get("enabled"),
    mode: current.get("mode"),
    sources: current.get("sources"),
    transition: current.get("transition"),
    ...Object.fromEntries(AREA_IDS.map((id) => [id, current.get(id)])),
  });
}

/** Settings live in user settings only; the patch they drive is shared by every window. */
async function write(key: string, value: unknown): Promise<void> {
  await config().update(key, value, ConfigurationTarget.Global);
}

export function setEnabled(enabled: boolean): Promise<void> {
  return write("enabled", enabled);
}

export function setMode(mode: Mode): Promise<void> {
  return write("mode", mode);
}

export function setSources(sources: ImageSource[]): Promise<void> {
  return write("sources", sources);
}

export async function updateArea(id: AreaId, patch: Partial<AreaSettings>): Promise<void> {
  const area = { ...readSettings().areas[id], ...patch };
  await write(id, areaToConfigValue(id, area));
}

export async function updateSource(id: string, patch: Partial<ImageSource>): Promise<void> {
  const sources = readSettings().sources.map((source) =>
    source.id === id ? { ...source, ...patch, id } : source
  );
  await setSources(sources);
}

export async function removeSource(id: string): Promise<void> {
  const settings = readSettings();
  await setSources(settings.sources.filter((source) => source.id !== id));
  for (const areaId of AREA_IDS) {
    if (settings.areas[areaId].source === id) {
      await updateArea(areaId, { source: null });
    }
  }
}

export async function addSources(sources: ImageSource[]): Promise<void> {
  await setSources([...readSettings().sources, ...sources]);
}

export async function replaceSettings(settings: UshiroeSettings): Promise<void> {
  await write("sources", settings.sources);
  for (const id of AREA_IDS) {
    await write(id, areaToConfigValue(id, settings.areas[id]));
  }
  await write("mode", settings.mode);
  await write("transition", settings.transition);
  await write("enabled", settings.enabled);
}

/** True when the user has not configured anything worth protecting from an import. */
export function isPristine(settings: UshiroeSettings = readSettings()): boolean {
  return settings.sources.length === 0;
}
