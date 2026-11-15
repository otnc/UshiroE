import { type Disposable, EventEmitter, l10n, window } from "vscode";

import { type ImageResolver, buildLiveConfig } from "./core/resolve";
import type { LiveStore } from "./liveStore";
import { readSettings } from "./settings";

/** Keeps the live config the workbench polls in step with the settings and the image library. */
export class LiveSync implements Disposable {
  private readonly changed = new EventEmitter<void>();
  readonly onDidChange = this.changed.event;

  private cycle = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly store: LiveStore,
    private readonly resolver: ImageResolver
  ) {}

  /** Coalesces bursts of changes, such as several settings written one after another. */
  schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), 150);
  }

  async sync(): Promise<void> {
    try {
      await this.store.write(buildLiveConfig(readSettings(), this.cycle, this.resolver));
    } catch (error) {
      void window.showErrorMessage(
        l10n.t("UshiroE could not save its live configuration: {0}", String(error))
      );
    }
    this.changed.fire();
  }

  async nextImage(): Promise<void> {
    this.cycle++;
    await this.sync();
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.changed.dispose();
  }
}
