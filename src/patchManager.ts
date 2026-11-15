import {
  type Disposable,
  EventEmitter,
  type ExtensionContext,
  Uri,
  commands,
  env,
  extensions,
  l10n,
  window,
} from "vscode";

import { type Ownership, decideOwnership } from "./core/ownership";
import { type RepairRecord, decideStartupRepair, resetRepairs } from "./core/repairGuard";
import { BACKIMAGE_EXTENSION_ID } from "./migration/backimage";
import type { PatchStatus, Patcher } from "./patcher";
import { readPatchOptions, readSettings, setBackImagePriority, setEnabled } from "./settings";
import { outdatedPatchMessage, promptRestart } from "./ui/prompts";
import { CancelledError } from "./workbench/fileio";
import { IntegrityError } from "./workbench/integrity";
import { LockedError } from "./workbench/lock";

const CONSENT_KEY = "patchConsent";
const REPAIR_KEY = "startupRepair";
const LEFTOVER_ASKED_KEY = "leftoverPatchAsked";
const TROUBLESHOOTING_URL = "https://github.com/otnc/UshiroE#troubleshooting";

export type PatchReason = "enable" | "startup" | "manual";

/** Why the last write was skipped; read by the integration tests. */
export type BlockedReason = "conflict" | "backImage" | "restartFirst" | "integrity" | "repairLoop";

/**
 * Owns the user's consent and every change to VS Code's workbench files. Before any write it checks who owns the workbench, whether the files are intact and whether a repair would loop.
 */
export class PatchManager implements Disposable {
  private readonly changed = new EventEmitter<void>();
  readonly onDidChange = this.changed.event;

  private current: PatchStatus | undefined;
  private restartNeeded = false;
  /** BackImage was uninstalled or disabled in this session, but its code is still loaded. */
  private restartBeforePatch = false;
  private conflictShown = false;
  lastBlocked: BlockedReason | undefined;

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

  get backImageActive(): boolean {
    return extensions.getExtension(BACKIMAGE_EXTENSION_ID) !== undefined;
  }

  ownership(): Ownership {
    return decideOwnership(readPatchOptions().backImagePriority, {
      active: this.backImageActive,
      hasBlock: this.current?.hasBackImage ?? false,
      hasBackups: this.current?.hasBackImageBackups ?? false,
    });
  }

  async refresh(): Promise<void> {
    try {
      this.current = await this.patcher.status();
    } catch {
      this.current = undefined;
    }
    this.changed.fire();
  }

  /** After uninstalling or disabling BackImage, patching waits for the next start. */
  requireRestartBeforePatch(): void {
    this.restartBeforePatch = true;
    this.changed.fire();
  }

  get waitingForRestart(): boolean {
    return this.restartBeforePatch;
  }

  /**
   * Checks everything that must hold before UshiroE writes. Returns false, after telling the user when that helps, if nothing may be written now.
   */
  private async mayWrite(reason: PatchReason): Promise<boolean> {
    const ownership = this.ownership();
    if (ownership.kind === "backImage") {
      this.lastBlocked = "backImage";
      return false;
    }
    if (ownership.kind === "conflict") {
      this.lastBlocked = "conflict";
      // Not awaited: the choice is handled whenever the user answers.
      void this.showConflict();
      return false;
    }
    if (this.restartBeforePatch) {
      this.lastBlocked = "restartFirst";
      if (reason !== "startup") {
        void promptRestart(
          l10n.t(
            "Quit and reopen VS Code to unload BackImage. UshiroE applies its patch after the restart."
          )
        );
      }
      return false;
    }
    if (this.current?.problem) {
      this.lastBlocked = "integrity";
      this.reportError(new IntegrityError(this.current.problem));
      return false;
    }
    return true;
  }

  /** Explains that BackImage is active and lets the user pick who owns the workbench. */
  private async showConflict(): Promise<void> {
    if (this.conflictShown) {
      return;
    }
    this.conflictShown = true;
    const uninstall = l10n.t("Uninstall BackImage");
    const disable = l10n.t("Disable BackImage");
    const yieldTo = l10n.t("Let BackImage Take Over");
    const choice = await window.showWarningMessage(
      l10n.t(
        "BackImage is active and modifies the same VS Code files. Uninstall or disable BackImage before applying the UshiroE patch."
      ),
      uninstall,
      disable,
      yieldTo
    );
    if (choice === uninstall) {
      await commands.executeCommand("ushiroe.uninstallBackImage");
    } else if (choice === disable) {
      await commands.executeCommand("ushiroe.disableBackImage");
    } else if (choice === yieldTo) {
      await setBackImagePriority("backImage");
    }
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

  private offerManualRepair(message: string): void {
    const repair = l10n.t("Repair Patch");
    void Promise.resolve(window.showWarningMessage(message, repair))
      .then((choice) => {
        if (choice === repair && readSettings().enabled) {
          return this.ensure("manual");
        }
      })
      .catch((error: unknown) => this.reportError(error));
  }

  /** Decides whether a startup repair may run, so a lost patch is re-applied at most once. */
  private async allowStartupRepair(): Promise<boolean> {
    const commit = this.current?.commit ?? "unknown";
    const decision = decideStartupRepair(
      this.context.globalState.get<RepairRecord>(REPAIR_KEY),
      commit,
      this.current?.state !== "applied",
      Date.now()
    );
    await this.context.globalState.update(REPAIR_KEY, decision.record);
    if (decision.action !== "stop") {
      return decision.action === "repair";
    }
    this.lastBlocked = "repairLoop";
    if (this.current?.state === "outdated") {
      // A warning about a prior lost patch must not hide the prompt for a newer runtime.
      this.offerManualRepair(outdatedPatchMessage());
    } else if (decision.warn) {
      this.offerManualRepair(
        l10n.t(
          "The UshiroE patch disappeared again after repair. Another extension may be overwriting the workbench file, so UshiroE stopped repairing the patch automatically."
        )
      );
    }
    return false;
  }

  /** Makes sure the workbench script carries the current patch, asking to restart when it changed. */
  async ensure(reason: PatchReason): Promise<void> {
    this.lastBlocked = undefined;
    await this.refresh();
    if (reason !== "manual" && this.current?.state === "applied") {
      return;
    }
    if (!(await this.mayWrite(reason))) {
      return;
    }
    const options = readPatchOptions();
    if (reason === "startup") {
      if (!options.autoRepair) {
        this.offerManualRepair(
          this.current?.state === "outdated"
            ? outdatedPatchMessage()
            : l10n.t("UshiroE's patch needs repair to show backgrounds.")
        );
        return;
      }
      if (!(await this.allowStartupRepair())) {
        return;
      }
    } else if (reason === "manual") {
      await this.context.globalState.update(
        REPAIR_KEY,
        resetRepairs(this.current?.commit ?? "unknown")
      );
    }
    const patchedBefore = this.context.globalState.get<boolean>(CONSENT_KEY) === true;
    if (!(await this.askConsent())) {
      if (reason === "enable") {
        await setEnabled(false);
      }
      return;
    }
    if (
      this.current?.hasBackImageBackups &&
      !(await this.cleanUpBackImage(options.hideCorruptWarning))
    ) {
      return;
    }
    await this.run(reason, async () => {
      if (await this.patcher.apply(options.hideCorruptWarning)) {
        await this.markRestartNeeded(
          reason === "startup" && patchedBefore
            ? l10n.t("UshiroE repaired its patch. Quit and reopen VS Code to apply the changes.")
            : l10n.t(
                "The UshiroE patch is in place. Quit and reopen VS Code to see the background."
              )
        );
      } else if (reason === "manual") {
        void window.showInformationMessage(l10n.t("UshiroE's patch is already up to date."));
      }
    });
  }

  /** Asks to delete BackImage's backups, which it would otherwise use to overwrite the script. */
  private async cleanUpBackImage(hideCorruptWarning: boolean): Promise<boolean> {
    const remove = l10n.t("Delete");
    const choice = await window.showWarningMessage(
      l10n.t(
        "BackImage left backup copies of VS Code's files. Delete them before UshiroE applies its patch?"
      ),
      {
        modal: true,
        detail: l10n.t(
          "Restoring files from these backups can remove the UshiroE patch or overwrite files from a newer VS Code build."
        ),
      },
      remove
    );
    if (choice !== remove) {
      return false;
    }
    return this.run("manual", () => this.patcher.removeBackImageLeftovers(hideCorruptWarning));
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
    await this.refresh();
    if (!(await this.mayWrite("manual"))) {
      return;
    }
    await this.run("manual", async () => {
      if (await this.patcher.remove()) {
        await this.markRestartNeeded(
          l10n.t("UshiroE's patch was removed. Restart VS Code to finish.")
        );
      } else {
        void window.showInformationMessage(l10n.t("UshiroE's patch is not installed."));
      }
    });
  }

  /** Puts VS Code's workbench back as it was installed, from UshiroE's saved copy if possible. */
  async restoreWorkbench(): Promise<void> {
    await this.refresh();
    const ownership = this.ownership();
    if (ownership.kind !== "ushiroe" || this.restartBeforePatch) {
      await this.mayWrite("manual");
      return;
    }
    await setEnabled(false);
    await this.run("manual", async () => {
      const result = await this.patcher.restore();
      if (result === "nothing") {
        void window.showInformationMessage(l10n.t("VS Code's workbench has no UshiroE changes."));
      } else {
        await this.markRestartNeeded(
          l10n.t("VS Code's workbench was restored. Restart VS Code to finish.")
        );
      }
    });
  }

  /**
   * Offers to remove a patch left by an earlier UshiroE installation that was uninstalled without removing it. Asked once; nothing is removed without the user's answer.
   */
  async offerLeftoverRemoval(): Promise<void> {
    await this.refresh();
    if (
      this.current?.blockHash === null ||
      this.current === undefined ||
      readSettings().enabled ||
      this.context.globalState.get<boolean>(CONSENT_KEY) ||
      this.context.globalState.get<boolean>(LEFTOVER_ASKED_KEY)
    ) {
      return;
    }
    await this.context.globalState.update(LEFTOVER_ASKED_KEY, true);
    const remove = l10n.t("Remove");
    const keep = l10n.t("Keep");
    const choice = await window.showInformationMessage(
      l10n.t(
        "VS Code still contains UshiroE's patch from an earlier installation. Remove it now? You can apply it again by turning the background on."
      ),
      remove,
      keep
    );
    if (choice !== remove || !(await this.mayWrite("manual"))) {
      return;
    }
    await this.run("manual", async () => {
      if (await this.patcher.remove()) {
        await this.markRestartNeeded(
          l10n.t("UshiroE's patch was removed. Restart VS Code to finish.")
        );
      }
    });
  }

  /** Runs a file change, reporting failures. Returns false when it failed or was cancelled. */
  async run(reason: PatchReason, task: () => Promise<unknown>): Promise<boolean> {
    try {
      await task();
      return true;
    } catch (error) {
      if (error instanceof LockedError) {
        // Another window is already on it; a startup repair can simply be skipped.
        if (reason !== "startup") {
          void window.showInformationMessage(
            l10n.t("Another VS Code window is updating UshiroE's patch. Try again in a moment.")
          );
        }
      } else if (!(error instanceof CancelledError)) {
        this.reportError(error);
      }
      return false;
    } finally {
      await this.refresh();
    }
  }

  private reportError(error: unknown): void {
    const message =
      error instanceof IntegrityError
        ? error.reason === "truncated"
          ? l10n.t("VS Code's workbench file looks truncated or damaged. Reinstall VS Code.")
          : l10n.t(
              "VS Code's workbench file was changed by something other than UshiroE, so UshiroE will not touch it. Reinstall VS Code, or see Troubleshooting."
            )
        : error instanceof Error
          ? error.message
          : String(error);
    const help = l10n.t("Troubleshooting");
    void window
      .showErrorMessage(l10n.t("UshiroE could not modify VS Code: {0}", message), help)
      .then((choice) => {
        if (choice === help) {
          void env.openExternal(Uri.parse(TROUBLESHOOTING_URL));
        }
      });
  }

  private async markRestartNeeded(message: string): Promise<void> {
    this.restartNeeded = true;
    this.changed.fire();
    await promptRestart(message);
  }

  /** Lets the user give the workbench to BackImage or take it back. */
  async setPriority(priority: "ushiroe" | "backImage"): Promise<void> {
    this.conflictShown = false;
    await setBackImagePriority(priority);
    await this.refresh();
  }

  dispose(): void {
    this.changed.dispose();
  }
}
