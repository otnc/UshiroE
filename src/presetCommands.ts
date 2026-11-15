import { type ExtensionContext, l10n, window } from "vscode";

import type { Preset } from "./core/model";
import { pickRandomPreset, presetFromSettings } from "./core/presets";
import { applyPreset, readSettings, setPresets } from "./settings";

const LAST_RANDOM_KEY = "lastRandomPresetAt";
/** Windows opened within this many milliseconds share one random pick at startup. */
const STARTUP_GRACE_MS = 30_000;

async function pickPreset(placeHolder: string): Promise<Preset | undefined> {
  const presets = readSettings().presets;
  if (presets.length === 0) {
    void window.showInformationMessage(l10n.t("There are no presets yet. Save one first."));
    return undefined;
  }
  const item = await window.showQuickPick(
    presets.map((preset) => ({ label: preset.name, preset })),
    { placeHolder }
  );
  return item?.preset;
}

function findPreset(id: unknown): Preset | undefined {
  return typeof id === "string"
    ? readSettings().presets.find((preset) => preset.id === id)
    : undefined;
}

export async function savePreset(): Promise<void> {
  const settings = readSettings();
  const name = (
    await window.showInputBox({
      prompt: l10n.t("Preset name"),
      value: l10n.t("Preset {0}", settings.presets.length + 1),
      validateInput: (value) => (value.trim() === "" ? l10n.t("Enter a name.") : undefined),
    })
  )?.trim();
  if (!name) {
    return;
  }
  const existing = settings.presets.find((preset) => preset.name === name);
  if (existing) {
    const overwrite = l10n.t("Overwrite");
    const choice = await window.showWarningMessage(
      l10n.t('A preset named "{0}" already exists. Overwrite it?', name),
      { modal: true },
      overwrite
    );
    if (choice !== overwrite) {
      return;
    }
  }
  const created = presetFromSettings(name, settings);
  const preset = existing ? { ...created, id: existing.id } : created;
  await setPresets(
    existing
      ? settings.presets.map((candidate) => (candidate.id === existing.id ? preset : candidate))
      : [...settings.presets, preset]
  );
  void window.setStatusBarMessage(l10n.t("UshiroE: saved preset {0}", name), 3000);
}

/** Applies the preset with the given id, or asks which one when called without an id. */
export async function applyPresetCommand(id?: unknown): Promise<void> {
  const preset = findPreset(id) ?? (await pickPreset(l10n.t("Apply which preset?")));
  if (preset) {
    await applyPreset(preset);
    void window.setStatusBarMessage(l10n.t("UshiroE: applied preset {0}", preset.name), 3000);
  }
}

export async function deletePreset(id?: unknown): Promise<void> {
  const preset = findPreset(id) ?? (await pickPreset(l10n.t("Delete which preset?")));
  if (preset) {
    await setPresets(readSettings().presets.filter((candidate) => candidate.id !== preset.id));
  }
}

export async function applyRandomPreset(): Promise<void> {
  const preset = pickRandomPreset(readSettings());
  if (!preset) {
    void window.showInformationMessage(l10n.t("There are no presets yet. Save one first."));
    return;
  }
  await applyPreset(preset);
  void window.setStatusBarMessage(l10n.t("UshiroE: applied preset {0}", preset.name), 3000);
}

/**
 * Applies a random preset when VS Code starts. Settings are shared by every window, so windows
 * that open together reuse the first window's pick instead of each choosing again.
 */
export async function applyRandomPresetOnStartup(context: ExtensionContext): Promise<void> {
  const settings = readSettings();
  if (!settings.randomPresetOnStartup || settings.presets.length === 0) {
    return;
  }
  const last = context.globalState.get<number>(LAST_RANDOM_KEY, 0);
  if (Date.now() - last < STARTUP_GRACE_MS) {
    return;
  }
  await context.globalState.update(LAST_RANDOM_KEY, Date.now());
  const preset = pickRandomPreset(settings);
  if (preset) {
    await applyPreset(preset);
  }
}
