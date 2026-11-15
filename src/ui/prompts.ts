import { commands, l10n, window } from "vscode";

import { isPristine } from "../settings";

export const outdatedPatchMessage = () =>
  l10n.t("UshiroE's patch is out of date. Repair it to apply the update.");

/**
 * Asks to restart VS Code. A window reload is not enough after the workbench script changes, because the renderer keeps the old script cached until VS Code quits.
 */
export async function promptRestart(message: string): Promise<void> {
  const quit = l10n.t("Quit VS Code");
  if ((await window.showInformationMessage(message, quit)) === quit) {
    await commands.executeCommand("workbench.action.quit");
  }
}

/** Skips the overwrite prompt when there are no existing settings to replace. */
export async function confirmReplaceSettings(message: string): Promise<boolean> {
  if (isPristine()) {
    return true;
  }
  const replace = l10n.t("Replace");
  return (await window.showWarningMessage(message, { modal: true }, replace)) === replace;
}
