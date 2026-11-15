import {
  type Disposable,
  EventEmitter,
  type FileSystemWatcher,
  RelativePattern,
  Uri,
  l10n,
  window,
  workspace,
} from "vscode";

import { type UshiroeSettings, activeAreas } from "./core/model";
import { buildLiveConfig } from "./core/resolve";
import type { LiveStore } from "./liveStore";
import { readSettings } from "./settings";

/** Keeps the live config the workbench polls in step with the settings and the image folders. */
export class LiveSync implements Disposable {
  private readonly changed = new EventEmitter<void>();
  readonly onDidChange = this.changed.event;

  private cycle = 0;
  private watchers: FileSystemWatcher[] = [];
  private watchedKey = "";
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly store: LiveStore) {}

  /** Coalesces bursts of changes, such as several settings written one after another. */
  schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), 150);
  }

  async sync(): Promise<void> {
    const settings = readSettings();
    try {
      await this.store.write(await buildLiveConfig(settings, this.cycle));
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

  /** Watches folder sources in use, so added or removed images show up without re-applying. */
  private updateWatchers(settings: UshiroeSettings): void {
    const sources = new Map(settings.sources.map((source) => [source.id, source]));
    const folders = activeAreas(settings).flatMap((id) => {
      const source = sources.get(settings.areas[id].source ?? "");
      return source?.type === "folder" ? [source] : [];
    });
    const key = JSON.stringify(folders.map((source) => [source.path, source.recursive]));
    if (key === this.watchedKey) {
      return;
    }
    this.watchedKey = key;
    this.disposeWatchers();
    for (const source of folders) {
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(Uri.file(source.path), source.recursive ? "**/*" : "*")
      );
      watcher.onDidCreate(() => this.schedule());
      watcher.onDidDelete(() => this.schedule());
      this.watchers.push(watcher);
    }
  }

  private disposeWatchers(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.disposeWatchers();
    this.changed.dispose();
  }
}
