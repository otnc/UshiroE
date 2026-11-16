import { type Disposable, l10n, window } from "vscode";

import type { AreaId } from "./core/model";
import {
  type AreaOpacities,
  revertOpacity,
  riskyIncreases,
  visibleOpacities,
} from "./core/opacity";
import { readSettings, updateArea } from "./settings";

/** Seconds a high opacity stays applied without the user confirming it. */
export const CONFIRM_SECONDS = 15;

interface PendingConfirmation {
  /** Opacity to restore for each area, taken from before the first unconfirmed increase. */
  restore: Map<AreaId, number>;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Asks the user to keep a high opacity and reverts it when they do not answer, like a display resolution change. An image that hides the UI also hides the controls to lower its opacity.
 */
export class OpacityGuard implements Disposable {
  private settings = readSettings();
  private shown: AreaOpacities = visibleOpacities(this.settings);
  private pending: PendingConfirmation | undefined;

  settingsChanged(): void {
    const previous = this.settings;
    this.settings = readSettings();
    const shown = visibleOpacities(this.settings);
    const risky = riskyIncreases(this.shown, shown);
    this.shown = shown;
    if (risky.length > 0) {
      this.confirm(risky, (id) => previous.areas[id].opacity);
    }
  }

  private confirm(areas: AreaId[], previousOpacity: (id: AreaId) => number): void {
    const restore = this.pending?.restore ?? new Map<AreaId, number>();
    for (const id of areas) {
      if (!restore.has(id)) {
        restore.set(id, revertOpacity(previousOpacity(id)));
      }
    }
    clearTimeout(this.pending?.timer);
    const pending: PendingConfirmation = {
      restore,
      timer: setTimeout(() => void this.timeOut(pending), CONFIRM_SECONDS * 1000),
    };
    this.pending = pending;
    void this.ask(pending);
  }

  private async ask(pending: PendingConfirmation): Promise<void> {
    const keep = l10n.t("Keep");
    const revert = l10n.t("Revert");
    const answer = await window.showWarningMessage(
      l10n.t(
        "The background is now very opaque and may hide the UI. It goes back in {0} seconds unless you keep it.",
        CONFIRM_SECONDS
      ),
      keep,
      revert
    );
    // A later change replaced this prompt, or the time already ran out.
    if (this.pending !== pending) {
      return;
    }
    if (answer === keep) {
      clearTimeout(pending.timer);
      this.pending = undefined;
    } else if (answer === revert) {
      await this.revert(pending);
    }
  }

  private async timeOut(pending: PendingConfirmation): Promise<void> {
    if (await this.revert(pending)) {
      void window.showInformationMessage(
        l10n.t("UshiroE lowered the background opacity because the change was not confirmed.")
      );
    }
  }

  /** Returns false when the prompt was already answered or replaced. */
  private async revert(pending: PendingConfirmation): Promise<boolean> {
    if (this.pending !== pending) {
      return false;
    }
    clearTimeout(pending.timer);
    this.pending = undefined;
    for (const [id, opacity] of pending.restore) {
      if (readSettings().areas[id].opacity > opacity) {
        await updateArea(id, { opacity });
      }
    }
    return true;
  }

  dispose(): void {
    clearTimeout(this.pending?.timer);
    this.pending = undefined;
  }
}
