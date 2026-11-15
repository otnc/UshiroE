import fs from "node:fs";
import path from "node:path";

import { type ExtensionContext, Uri, commands, extensions, l10n, window } from "vscode";

import type { PatchManager } from "../patchManager";
import { isPristine, replaceSettings } from "../settings";
import { confirmReplaceSettings, promptRestart } from "../ui/prompts";
import {
  BACKIMAGE_EXTENSION_ID,
  convertBackImageState,
  findStateDatabases,
  readBackImageState,
} from "./backimage";

const PROMPT_DONE_KEY = "backImagePromptDone";
const PATCH_AFTER_RESTART_KEY = "patchAfterBackImageRestart";

interface FoundState {
  label: string;
  state: unknown;
}

/** The user-facing steps of moving from BackImage: detect, import, uninstall and clean up. */
export class BackImageMigration {
  constructor(
    private readonly context: ExtensionContext,
    private readonly patch: PatchManager
  ) {}

  get installed(): boolean {
    return extensions.getExtension(BACKIMAGE_EXTENSION_ID) !== undefined;
  }

  /** Offers the import once, when BackImage is around and UshiroE is not configured yet. */
  async offer(): Promise<void> {
    if (this.context.globalState.get<boolean>(PROMPT_DONE_KEY) || !isPristine()) {
      return;
    }
    if (!this.installed && this.patch.patcher.existingBackImageBackups().length === 0) {
      return;
    }
    const importLabel = l10n.t("Import");
    const never = l10n.t("Don't Ask Again");
    const choice = await window.showInformationMessage(
      l10n.t("BackImage was found. Import its settings into UshiroE?"),
      importLabel,
      never
    );
    if (choice === importLabel) {
      await this.import();
    } else if (choice === never) {
      await this.context.globalState.update(PROMPT_DONE_KEY, true);
    }
  }

  private async findStates(): Promise<FoundState[]> {
    const globalStorageDir = path.dirname(this.context.globalStorageUri.fsPath);
    const wasm = Uri.joinPath(this.context.extensionUri, "dist", "sql-wasm.wasm").fsPath;
    const found: FoundState[] = [];
    for (const database of findStateDatabases(globalStorageDir)) {
      try {
        const state = await readBackImageState(database.file, wasm);
        if (state !== null) {
          found.push({ label: database.label, state });
        }
      } catch (error) {
        console.warn(`[UshiroE] Could not read ${database.file}`, error);
      }
    }
    return found;
  }

  private async pick(found: FoundState[]): Promise<FoundState | undefined> {
    if (found.length <= 1) {
      return found[0];
    }
    const item = await window.showQuickPick(
      found.map((entry) => ({
        label:
          entry.label === "default"
            ? l10n.t("Default profile")
            : l10n.t("Profile {0}", entry.label),
        entry,
      })),
      {
        placeHolder: l10n.t(
          "BackImage settings exist in several profiles. Which one should be imported?"
        ),
      }
    );
    return item?.entry;
  }

  async import(): Promise<void> {
    const found = await this.findStates();
    if (found.length === 0) {
      void window.showInformationMessage(l10n.t("No BackImage settings were found."));
      return;
    }
    const picked = await this.pick(found);
    if (!picked) {
      return;
    }
    const settings = convertBackImageState(picked.state);
    if (!settings) {
      void window.showErrorMessage(l10n.t("BackImage's settings could not be read."));
      return;
    }
    if (
      !(await confirmReplaceSettings(
        l10n.t("Replace the current UshiroE settings with BackImage's settings?")
      ))
    ) {
      return;
    }
    await replaceSettings(settings);
    await this.context.globalState.update(PROMPT_DONE_KEY, true);

    const missing = settings.sources.filter((source) => !fs.existsSync(source.path)).length;
    const summary = [
      l10n.t("Imported {0} image sources from BackImage.", settings.sources.length),
      missing > 0 ? l10n.t("{0} of them could not be found on disk.", missing) : "",
      settings.enabled ? "" : l10n.t("Backgrounds stay off until you enable them."),
    ]
      .filter((part) => part !== "")
      .join(" ");
    if (!this.installed) {
      void window.showInformationMessage(summary);
      return;
    }
    const uninstall = l10n.t("Uninstall BackImage");
    const choice = await window.showInformationMessage(
      `${summary} ${l10n.t("BackImage and UshiroE both modify VS Code, so keeping both installed causes conflicts.")}`,
      uninstall
    );
    if (choice === uninstall) {
      await this.uninstall();
    }
  }

  /**
   * Uninstalls BackImage. Its code stays loaded until VS Code restarts, so UshiroE changes
   * nothing now and applies its patch on the next start, after asking to delete the leftovers.
   */
  async uninstall(): Promise<void> {
    try {
      await commands.executeCommand(
        "workbench.extensions.uninstallExtension",
        BACKIMAGE_EXTENSION_ID
      );
    } catch (error) {
      void window.showErrorMessage(String(error));
      return;
    }
    await this.afterBackImageStopped();
  }

  /** VS Code has no command to disable one extension, so this opens BackImage's page. */
  async disable(): Promise<void> {
    await commands.executeCommand("extension.open", BACKIMAGE_EXTENSION_ID);
    void window.showInformationMessage(
      l10n.t('Click "Disable" on BackImage\'s page, then restart VS Code.')
    );
    await this.afterBackImageStopped();
  }

  private async afterBackImageStopped(): Promise<void> {
    this.patch.requireRestartBeforePatch();
    await this.context.globalState.update(PATCH_AFTER_RESTART_KEY, true);
    await promptRestart(
      l10n.t(
        "Restart VS Code so that BackImage stops running. UshiroE applies its patch after the restart."
      )
    );
  }

  /** True once, on the first start after BackImage was uninstalled or disabled. */
  async takePatchAfterRestart(): Promise<boolean> {
    const pending = this.context.globalState.get<boolean>(PATCH_AFTER_RESTART_KEY) === true;
    if (pending) {
      await this.context.globalState.update(PATCH_AFTER_RESTART_KEY, undefined);
    }
    return pending;
  }
}
