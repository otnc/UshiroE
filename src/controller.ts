import fs from "node:fs";
import path from "node:path";

import {
  type ConfigurationChangeEvent,
  type Disposable,
  EventEmitter,
  type ExtensionContext,
  type FileSystemWatcher,
  RelativePattern,
  Uri,
  commands,
  extensions,
  l10n,
  window,
  workspace,
} from "vscode";

import { activeAreas, type UshiroeSettings } from "./core/model";
import { buildLiveConfig } from "./core/resolve";
import type { LiveStore } from "./liveStore";
import {
  BACKIMAGE_EXTENSION_ID,
  convertBackImageState,
  findStateDatabases,
  readBackImageState,
} from "./migration/backimage";
import { CancelledError, type PatchStatus, type Patcher } from "./patcher";
import { SECTION, isPristine, readSettings, replaceSettings, setEnabled } from "./settings";

const CONSENT_KEY = "patchConsent";
const BACKIMAGE_PROMPT_KEY = "backImagePromptDone";

type PatchReason = "enable" | "startup" | "manual";

export class Controller implements Disposable {
  private readonly changed = new EventEmitter<void>();
  /** Fires when settings, patch status or the live config change. */
  readonly onDidChange = this.changed.event;

  private cycle = 0;
  private watchers: FileSystemWatcher[] = [];
  private watchedKey = "";
  private syncTimer: ReturnType<typeof setTimeout> | undefined;
  private patchStatus: PatchStatus | undefined;
  private restartPending = false;
  private wasEnabled = false;

  constructor(
    private readonly context: ExtensionContext,
    private readonly patcher: Patcher,
    private readonly live: LiveStore
  ) {}

  get status(): { patch: PatchStatus | undefined; restartPending: boolean } {
    return { patch: this.patchStatus, restartPending: this.restartPending };
  }

  get backImageInstalled(): boolean {
    return extensions.getExtension(BACKIMAGE_EXTENSION_ID) !== undefined;
  }

  async start(): Promise<void> {
    const settings = readSettings();
    this.wasEnabled = settings.enabled;
    await this.sync();
    await this.refreshPatchStatus();
    if (settings.enabled) {
      await this.ensurePatch("startup");
    }
    void this.offerBackImageImport();
  }

  onConfigurationChanged(event: ConfigurationChangeEvent): void {
    if (!event.affectsConfiguration(SECTION)) {
      return;
    }
    this.scheduleSync();
    const enabled = readSettings().enabled;
    if (enabled && !this.wasEnabled) {
      void this.ensurePatch("enable");
    }
    this.wasEnabled = enabled;
  }

  scheduleSync(): void {
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => void this.sync(), 150);
  }

  async sync(): Promise<void> {
    const settings = readSettings();
    try {
      await this.live.write(await buildLiveConfig(settings, this.cycle));
    } catch (error) {
      void window.showErrorMessage(
        l10n.t("UshiroE could not save its live configuration: {0}", String(error))
      );
    }
    this.updateWatchers(settings);
    this.changed.fire();
  }

  async nextImage(): Promise<void> {
    this.cycle++;
    await this.sync();
  }

  async refreshPatchStatus(): Promise<void> {
    try {
      this.patchStatus = await this.patcher.status();
    } catch {
      this.patchStatus = undefined;
    }
    this.changed.fire();
  }

  private async askConsent(): Promise<boolean> {
    if (this.context.globalState.get<boolean>(CONSENT_KEY)) {
      return true;
    }
    const proceed = l10n.t("Continue");
    const choice = await window.showWarningMessage(
      l10n.t("UshiroE draws backgrounds by adding a small script to VS Code's workbench file."),
      {
        modal: true,
        detail: l10n.t(
          'VS Code has no official API for this. UshiroE keeps the change minimal and can remove it at any time with "UshiroE: Remove Patch from VS Code". After VS Code updates, UshiroE re-applies it automatically.'
        ),
      },
      proceed
    );
    if (choice !== proceed) {
      return false;
    }
    await this.context.globalState.update(CONSENT_KEY, true);
    return true;
  }

  /**
   * Makes sure the workbench script carries the current patch, asking to restart when it changed.
   * A window reload is not enough: the renderer keeps the old workbench script in its cache.
   */
  async ensurePatch(reason: PatchReason): Promise<void> {
    await this.refreshPatchStatus();
    if (reason !== "manual" && this.patchStatus?.state === "applied") {
      return;
    }
    if (
      reason === "startup" &&
      !workspace.getConfiguration(SECTION).get<boolean>("patch.autoRepair", true)
    ) {
      const repair = l10n.t("Repair");
      const choice = await window.showWarningMessage(
        l10n.t("UshiroE's patch is missing or outdated, probably because VS Code was updated."),
        repair
      );
      if (choice === repair) {
        await this.ensurePatch("manual");
      }
      return;
    }
    const patchedBefore = this.context.globalState.get<boolean>(CONSENT_KEY) === true;
    if (!(await this.askConsent())) {
      if (reason === "enable") {
        await setEnabled(false);
      }
      return;
    }
    try {
      const hide = workspace
        .getConfiguration(SECTION)
        .get<boolean>("patch.hideCorruptWarning", true);
      const changed = await this.patcher.apply(hide);
      await this.refreshPatchStatus();
      if (changed) {
        this.restartPending = true;
        this.changed.fire();
        await this.promptRestart(
          reason === "startup" && patchedBefore
            ? l10n.t(
                "UshiroE re-applied its patch after a VS Code update. Restart VS Code to show the background."
              )
            : l10n.t(
                "UshiroE is installed into VS Code. Restart VS Code (quit and open it again) to show the background."
              )
        );
      } else if (reason === "manual") {
        void window.showInformationMessage(l10n.t("UshiroE's patch is already up to date."));
      }
    } catch (error) {
      this.reportPatchError(error);
    }
  }

  async removePatch(): Promise<void> {
    const remove = l10n.t("Remove");
    const choice = await window.showWarningMessage(
      l10n.t("Remove UshiroE's patch from VS Code?"),
      {
        modal: true,
        detail: l10n.t(
          "Backgrounds are turned off and VS Code's workbench file is restored. Run this before uninstalling UshiroE."
        ),
      },
      remove
    );
    if (choice !== remove) {
      return;
    }
    try {
      await setEnabled(false);
      const changed = await this.patcher.remove();
      await this.refreshPatchStatus();
      if (changed) {
        this.restartPending = true;
        this.changed.fire();
        await this.promptRestart(l10n.t("UshiroE's patch was removed. Restart VS Code to finish."));
      } else {
        void window.showInformationMessage(l10n.t("UshiroE's patch is not installed."));
      }
    } catch (error) {
      this.reportPatchError(error);
    }
  }

  private reportPatchError(error: unknown): void {
    if (error instanceof CancelledError) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    void window.showErrorMessage(l10n.t("UshiroE could not modify VS Code: {0}", message));
  }

  private async promptRestart(message: string): Promise<void> {
    const quit = l10n.t("Quit VS Code");
    if ((await window.showInformationMessage(message, quit)) === quit) {
      await commands.executeCommand("workbench.action.quit");
    }
  }

  /** Watches folder sources in use, so added or removed images show up without re-applying. */
  private updateWatchers(settings: UshiroeSettings): void {
    const sources = new Map(settings.sources.map((source) => [source.id, source]));
    const folders = activeAreas(settings)
      .map((id) => sources.get(settings.areas[id].source ?? ""))
      .filter((source) => source?.type === "folder");
    const key = JSON.stringify(folders.map((source) => [source?.path, source?.recursive]));
    if (key === this.watchedKey) {
      return;
    }
    this.watchedKey = key;
    this.disposeWatchers();
    for (const source of folders) {
      if (!source) {
        continue;
      }
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(Uri.file(source.path), source.recursive ? "**/*" : "*")
      );
      watcher.onDidCreate(() => this.scheduleSync());
      watcher.onDidDelete(() => this.scheduleSync());
      this.watchers.push(watcher);
    }
  }

  private disposeWatchers(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
  }

  private async offerBackImageImport(): Promise<void> {
    if (this.context.globalState.get<boolean>(BACKIMAGE_PROMPT_KEY) || !isPristine()) {
      return;
    }
    if (!this.backImageInstalled && this.patcher.existingBackImageBackups().length === 0) {
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
      await this.importBackImage();
    } else if (choice === never) {
      await this.context.globalState.update(BACKIMAGE_PROMPT_KEY, true);
    }
  }

  async importBackImage(): Promise<void> {
    const globalStorageDir = path.dirname(this.context.globalStorageUri.fsPath);
    const wasm = Uri.joinPath(this.context.extensionUri, "dist", "sql-wasm.wasm").fsPath;
    const found: { label: string; state: unknown }[] = [];
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
    if (found.length === 0) {
      void window.showInformationMessage(l10n.t("No BackImage settings were found."));
      return;
    }

    let picked = found[0];
    if (found.length > 1) {
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
      if (!item) {
        return;
      }
      picked = item.entry;
    }

    const settings = convertBackImageState(picked.state);
    if (!settings) {
      void window.showErrorMessage(l10n.t("BackImage's settings could not be read."));
      return;
    }
    if (!isPristine()) {
      const replace = l10n.t("Replace");
      const choice = await window.showWarningMessage(
        l10n.t("Replace the current UshiroE settings with BackImage's settings?"),
        { modal: true },
        replace
      );
      if (choice !== replace) {
        return;
      }
    }
    await replaceSettings(settings);
    await this.context.globalState.update(BACKIMAGE_PROMPT_KEY, true);

    const missing = settings.sources.filter((source) => !fs.existsSync(source.path)).length;
    const summary =
      l10n.t("Imported {0} image sources from BackImage.", settings.sources.length) +
      (missing > 0 ? ` ${l10n.t("{0} of them could not be found on disk.", missing)}` : "") +
      (settings.enabled ? "" : ` ${l10n.t("Backgrounds stay off until you enable them.")}`);
    if (!this.backImageInstalled) {
      void window.showInformationMessage(summary);
      return;
    }
    const uninstall = l10n.t("Uninstall BackImage");
    const choice = await window.showInformationMessage(
      `${summary} ${l10n.t("BackImage and UshiroE both modify VS Code, so keeping both installed causes conflicts.")}`,
      uninstall
    );
    if (choice === uninstall) {
      await this.uninstallBackImage();
    }
  }

  private async uninstallBackImage(): Promise<void> {
    try {
      // Without its backups, BackImage cannot overwrite the workbench script with a stale copy.
      await this.patcher.removeBackImageLeftovers();
      await commands.executeCommand(
        "workbench.extensions.uninstallExtension",
        BACKIMAGE_EXTENSION_ID
      );
    } catch (error) {
      this.reportPatchError(error);
      return;
    }
    await this.refreshPatchStatus();
    if (readSettings().enabled && this.patchStatus?.state !== "applied") {
      await this.ensurePatch("enable");
      return;
    }
    await this.promptRestart(l10n.t("BackImage was uninstalled. Restart VS Code to finish."));
  }

  dispose(): void {
    clearTimeout(this.syncTimer);
    this.disposeWatchers();
    this.changed.dispose();
  }
}
