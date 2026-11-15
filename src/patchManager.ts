import { type Disposable, EventEmitter, type ExtensionContext, l10n, window } from "vscode";

import { CancelledError, type PatchStatus, type Patcher } from "./patcher";
import { readPatchOptions, setEnabled } from "./settings";
import { promptRestart } from "./ui/prompts";

const CONSENT_KEY = "patchConsent";

export type PatchReason = "enable" | "startup" | "manual";

/** Owns the user's consent, the patch status and every change to VS Code's workbench files. */
export class PatchManager implements Disposable {
  private readonly changed = new EventEmitter<void>();
  readonly onDidChange = this.changed.event;

  private current: PatchStatus | undefined;
  private restartNeeded = false;

  constructor(
    private readonly context: ExtensionContext,
    readonly patcher: Patcher
  ) {}

  get status(): PatchStatus | undefined {
    return this.current;
  }

  /** The workbench files changed in this session, so VS Code must restart to pick them up. */
  get restartPending(): boolean {
    return this.restartNeeded;
  }

  async refresh(): Promise<void> {
    try {
      this.current = await this.patcher.status();
    } catch {
      this.current = undefined;
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

  /** Makes sure the workbench script carries the current patch, asking to restart when it changed. */
  async ensure(reason: PatchReason): Promise<void> {
    await this.refresh();
    if (reason !== "manual" && this.current?.state === "applied") {
      return;
    }
    const options = readPatchOptions();
    if (reason === "startup" && !options.autoRepair) {
      const repair = l10n.t("Repair");
      const choice = await window.showWarningMessage(
        l10n.t("UshiroE's patch is missing or outdated, probably because VS Code was updated."),
        repair
      );
      if (choice === repair) {
        await this.ensure("manual");
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
    await this.run(async () => {
      if (await this.patcher.apply(options.hideCorruptWarning)) {
        await this.markRestartNeeded(
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
    });
  }

  async remove(): Promise<void> {
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
    await setEnabled(false);
    await this.run(async () => {
      if (await this.patcher.remove()) {
        await this.markRestartNeeded(
          l10n.t("UshiroE's patch was removed. Restart VS Code to finish.")
        );
      } else {
        void window.showInformationMessage(l10n.t("UshiroE's patch is not installed."));
      }
    });
  }

  /** Runs a file change, reporting failures. Returns false when it failed or was cancelled. */
  async run(task: () => Promise<void>): Promise<boolean> {
    try {
      await task();
      return true;
    } catch (error) {
      if (!(error instanceof CancelledError)) {
        const message = error instanceof Error ? error.message : String(error);
        void window.showErrorMessage(l10n.t("UshiroE could not modify VS Code: {0}", message));
      }
      return false;
    } finally {
      await this.refresh();
    }
  }

  private async markRestartNeeded(message: string): Promise<void> {
    this.restartNeeded = true;
    this.changed.fire();
    await promptRestart(message);
  }

  dispose(): void {
    this.changed.dispose();
  }
}
