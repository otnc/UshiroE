import path from "node:path";

import {
  type Disposable,
  EventEmitter,
  type FileSystemWatcher,
  ProgressLocation,
  RelativePattern,
  Uri,
  l10n,
  window,
  workspace,
} from "vscode";

import { ImageLibrary } from "./core/library";
import type { ImageSource, UshiroeSettings } from "./core/model";
import { picturesDir } from "./core/picturesDir";
import type { ImageLookup } from "./core/resolve";
import { readLibraryFolder, readSettings, setLibraryFolder } from "./settings";

interface SyncOptions {
  /** Download URL sources again even when a copy exists. */
  refreshUrls: (source: ImageSource) => boolean;
  /** Show a progress notification instead of a status bar spinner. */
  visible: boolean;
}

/** Keeps the image library in `<Pictures>/UshiroE/` in step with the configured sources. */
export class LibraryManager implements Disposable {
  /** `<Pictures>/UshiroE`, looked up once because it may spawn a process on Windows. */
  private defaultRootCache: string | undefined;
  private current: ImageLibrary | undefined;

  get defaultRoot(): string {
    this.defaultRootCache ??= path.join(picturesDir(), "UshiroE");
    return this.defaultRootCache;
  }

  /** The library in the folder the user chose, or in the default folder. */
  get library(): ImageLibrary {
    const root = readLibraryFolder() ?? this.defaultRoot;
    if (this.current?.root !== root) {
      this.current = new ImageLibrary(root);
    }
    return this.current;
  }

  private readonly changed = new EventEmitter<void>();
  /** Fires when copies were added or removed, so the live config can pick them up. */
  readonly onDidChange = this.changed.event;

  private watchers: FileSystemWatcher[] = [];
  private watchedKey = "";
  /** `id|url` pairs downloaded or tried in this session, so a failing URL is not retried in a loop. */
  private readonly triedUrls = new Set<string>();
  private queue: Promise<void> = Promise.resolve();

  readonly lookup: ImageLookup = (source) => this.library.images(source);

  get root(): string {
    return this.library.root;
  }

  /** Runs syncs one after another, so two never write the same library folder at once. */
  private enqueue(task: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(task, task);
    return this.queue;
  }

  sync(sources: readonly ImageSource[], options: SyncOptions): Promise<void> {
    return this.enqueue(async () => {
      if (sources.length === 0) {
        return;
      }
      const failures: string[] = [];
      await window.withProgress(
        {
          location: options.visible ? ProgressLocation.Notification : ProgressLocation.Window,
          title: l10n.t("UshiroE: copying images"),
        },
        async () => {
          for (const source of sources) {
            if (source.type === "url") {
              this.triedUrls.add(`${source.id}|${source.path}`);
            }
            try {
              await this.library.sync(source, options.refreshUrls(source));
            } catch (error) {
              // A missing original is fine as long as an earlier copy is still there.
              if (options.visible || this.library.images(source).length === 0) {
                const reason = error instanceof Error ? error.message : String(error);
                failures.push(`${source.name}: ${reason}`);
              }
            }
          }
        }
      );
      this.changed.fire();
      if (failures.length > 0) {
        void window.showWarningMessage(l10n.t("UshiroE could not copy some images."), {
          detail: failures.join("\n"),
        });
      }
    });
  }

  /** At startup: refreshes every source, downloading URLs set to refresh, and drops stale copies. */
  async startup(settings: UshiroeSettings = readSettings()): Promise<void> {
    await this.library.prune(settings.sources).catch(() => undefined);
    await this.sync(settings.sources, {
      refreshUrls: (source) => source.refresh === "startup",
      visible: false,
    });
    this.updateWatchers(settings);
  }

  /** After a settings change: copies new or edited sources and removes deleted ones. */
  async settingsChanged(settings: UshiroeSettings = readSettings()): Promise<void> {
    await this.library.prune(settings.sources).catch(() => undefined);
    const stale = settings.sources.filter(
      (source) =>
        this.library.isStale(source) &&
        (source.type !== "url" || !this.triedUrls.has(`${source.id}|${source.path}`))
    );
    await this.sync(stale, { refreshUrls: () => false, visible: false });
    this.updateWatchers(settings);
    this.changed.fire();
  }

  /** Copies everything again and downloads every URL, reporting each failure. */
  async refreshAll(): Promise<void> {
    await this.sync(readSettings().sources, { refreshUrls: () => true, visible: true });
  }

  /**
   * Lets the user pick another library folder. Copies are made again in the new folder by the
   * settings change that follows; the old folder is left as it is.
   */
  async chooseFolder(): Promise<void> {
    const picked = await window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: Uri.file(this.root),
      openLabel: l10n.t("Use This Folder"),
      title: l10n.t("Choose the folder UshiroE copies images into"),
    });
    if (picked?.length) {
      await setLibraryFolder(picked[0].fsPath);
    }
  }

  async resetFolder(): Promise<void> {
    await setLibraryFolder(undefined);
    void window.showInformationMessage(
      l10n.t("UshiroE copies images into {0} again.", this.defaultRoot)
    );
  }

  async refreshSource(id: string): Promise<void> {
    const source = readSettings().sources.find((candidate) => candidate.id === id);
    if (source) {
      await this.sync([source], { refreshUrls: () => true, visible: true });
    }
  }

  /** Watches source folders, so images added to or removed from them are copied right away. */
  private updateWatchers(settings: UshiroeSettings): void {
    const folders = settings.sources.filter((source) => source.type === "folder");
    const key = JSON.stringify(folders.map((source) => [source.id, source.path, source.recursive]));
    if (key === this.watchedKey) {
      return;
    }
    this.watchedKey = key;
    this.disposeWatchers();
    for (const source of folders) {
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(Uri.file(source.path), source.recursive ? "**/*" : "*")
      );
      // Copying many files fires many events; wait for them to settle before syncing once.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const resync = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const current = readSettings().sources.find((candidate) => candidate.id === source.id);
          if (current) {
            void this.sync([current], { refreshUrls: () => false, visible: false });
          }
        }, 500);
      };
      watcher.onDidCreate(resync);
      watcher.onDidChange(resync);
      watcher.onDidDelete(resync);
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
    this.disposeWatchers();
    this.changed.dispose();
  }
}
