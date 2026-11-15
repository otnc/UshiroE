import { commands, l10n, window } from "vscode";

import type { Preset } from "./core/model";
import { createPreset } from "./core/presets";
import { readSettings, removePreset, setPresets } from "./settings";

/** Asks for a name and adds an empty preset; its images are picked in the UshiroE view. */
export async function newPreset(): Promise<void> {
  const presets = readSettings().presets;
  const name = (
    await window.showInputBox({
      prompt: l10n.t("Name of the new preset"),
      value: l10n.t("Preset {0}", presets.length + 1),
      validateInput: (value) => (value.trim() === "" ? l10n.t("Enter a name.") : undefined),
    })
  )?.trim();
  if (!name) {
    return;
  }
  await setPresets([...presets, createPreset(name)]);
  // Show the view, where the new preset is waiting for its images.
  await commands.executeCommand("ushiroe.panel.focus");
}

async function pickPreset(placeHolder: string): Promise<Preset | undefined> {
  const presets = readSettings().presets;
  if (presets.length === 0) {
    void window.showInformationMessage(l10n.t("There are no presets yet."));
    return undefined;
  }
  const item = await window.showQuickPick(
    presets.map((preset) => ({ label: preset.name, preset })),
    { placeHolder }
  );
  return item?.preset;
}

/** Deletes the preset with the given id, or asks which one when called without an id. */
export async function deletePreset(id?: unknown): Promise<void> {
  const preset =
    readSettings().presets.find((candidate) => candidate.id === id) ??
    (await pickPreset(l10n.t("Delete which preset?")));
  if (!preset) {
    return;
  }
  const remove = l10n.t("Delete");
  const choice = await window.showWarningMessage(
    l10n.t('Delete the preset "{0}"? The images themselves are kept.', preset.name),
    { modal: true },
    remove
  );
  if (choice === remove) {
    await removePreset(preset.id);
  }
}
