import { ConfigurationTarget, workspace } from "vscode";

import {
  AREA_IDS,
  type AreaId,
  type AreaSettings,
  type ImageSource,
  type Mode,
  type Preset,
  type UshiroeSettings,
} from "./core/model";
import { areaToConfigValue, normalizeSettings, sourceToConfigValue } from "./core/normalize";

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
    shuffleInterval: current.get("shuffleInterval"),
    presets: current.get("presets"),
    randomPresetOnStartup: current.get("randomPresetOnStartup"),
    ...Object.fromEntries(AREA_IDS.map((id) => [id, current.get(id)])),
  });
}

export interface PatchOptions {
  hideCorruptWarning: boolean;
  autoRepair: boolean;
}

export function readPatchOptions(): PatchOptions {
  const current = config();
  return {
    hideCorruptWarning: current.get<boolean>("patch.hideCorruptWarning", true),
    autoRepair: current.get<boolean>("patch.autoRepair", true),
  };
}

/** The library folder the user chose, or null to use the default under the Pictures folder. */
export function readLibraryFolder(): string | null {
  const folder = config().get<string>("libraryFolder", "").trim();
  return folder === "" ? null : folder;
}

/** Pass undefined to go back to the default folder. */
export function setLibraryFolder(folder: string | undefined): Promise<void> {
  return write("libraryFolder", folder);
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
  return write("sources", sources.map(sourceToConfigValue));
}

export function setPresets(presets: Preset[]): Promise<void> {
  return write("presets", presets);
}

export function setShuffleInterval(seconds: number): Promise<void> {
  return write("shuffleInterval", Math.max(0, seconds));
}

export function setRandomPresetOnStartup(value: boolean): Promise<void> {
  return write("randomPresetOnStartup", value);
}

export async function updateArea(id: AreaId, patch: Partial<AreaSettings>): Promise<void> {
  const area = { ...readSettings().areas[id], ...patch };
  await write(id, areaToConfigValue(id, area));
}

async function writeLayout(mode: Mode, areas: Record<AreaId, AreaSettings>): Promise<void> {
  for (const id of AREA_IDS) {
    await write(id, areaToConfigValue(id, areas[id]));
  }
  await write("mode", mode);
}

export function applyPreset(preset: Preset): Promise<void> {
  return writeLayout(preset.mode, preset.areas);
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
  await setSources(settings.sources);
  await setPresets(settings.presets);
  await writeLayout(settings.mode, settings.areas);
  await write("transition", settings.transition);
  await write("shuffleInterval", settings.shuffleInterval);
  await write("randomPresetOnStartup", settings.randomPresetOnStartup);
  await write("enabled", settings.enabled);
}

/** True when the user has not configured anything worth protecting from an import. */
export function isPristine(settings: UshiroeSettings = readSettings()): boolean {
  return settings.sources.length === 0 && settings.presets.length === 0;
}
