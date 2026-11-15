import fs from "node:fs";
import path from "node:path";

import {
  type Disposable,
  EventEmitter,
  type FileSystemWatcher,
  ProgressLocation,
  RelativePattern,
  Uri,
  env,
  l10n,
  window,
  workspace,
} from "vscode";

import { ImageLibrary } from "./core/library";
import { IMAGE_EXTENSIONS, type ImageSource, type UshiroeSettings } from "./core/model";
import { picturesDir } from "./core/picturesDir";
import { parseImageRef } from "./core/normalize";
import { moveItem } from "./core/presets";
import type { ImageResolver } from "./core/resolve";
import { readLibraryFolder, readSettings, setLibraryFolder } from "./settings";

interface SyncOptions {
  /** Download URL sources again even when a copy exists. */
  refreshUrls: (source: ImageSource) => boolean;
  /** Show a progress notification instead of a status bar spinner. */
  visible: boolean;
}

/**
 * Keeps the image library in `<Pictures>/UshiroE/` in step with the configured sources. Sources
 * are imported once and not linked to their originals afterwards; only the library folder
 * itself is watched, so images the user drops into it show up.
 */
export class LibraryManager implements Disposable {
  /** `<Pictures>/UshiroE`, looked up once because it may spawn a process on Windows. */
  private defaultRootCache: string | undefined;
  private current: ImageLibrary | undefined;

  private readonly changed = new EventEmitter<void>();
  /** Fires when images were added or removed, so the live config can pick them up. */
  readonly onDidChange = this.changed.event;

  private watcher: FileSystemWatcher | undefined;
  private watchedRoot = "";
  private watchTimer: ReturnType<typeof setTimeout> | undefined;
  /** `id|url` pairs downloaded or tried in this session, so a failing URL is not retried in a loop. */
  private readonly triedUrls = new Set<string>();
  private queue: Promise<void> = Promise.resolve();

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

  readonly resolver: ImageResolver = {
    imagesOf: (source) => this.library.images(source),
    fileOf: (ref) => {
      const parsed = parseImageRef(ref);
      return parsed ? this.library.fileOf(parsed.sourceId, parsed.file) : null;
    },
  };

  /** Moves one image of a source up or down. */
  async moveImage(id: unknown, name: unknown, delta: number): Promise<void> {
    const source = this.find(id);
    if (!source || typeof name !== "string") {
      return;
    }
    await this.enqueue(async () => {
      const names = this.library.fileNames(source.id);
      await this.library.reorder(source, moveItem(names, names.indexOf(name), delta));
      this.changed.fire();
    });
  }

  /** Deletes one image from a source's folder in the library. */
  async removeImage(id: unknown, name: unknown): Promise<void> {
    const source = this.find(id);
    if (!source || typeof name !== "string") {
      return;
    }
    const remove = l10n.t("Delete");
    const choice = await window.showWarningMessage(
      l10n.t("Delete this image from UshiroE's image folder?"),
      {
        modal: true,
        detail: l10n.t(
          "The copy in the image folder is deleted. An image you put into the folder yourself is deleted for good."
        ),
      },
      remove
    );
    if (choice !== remove) {
      return;
    }
    await this.enqueue(async () => {
      await this.library.removeImage(source, name);
      this.changed.fire();
    });
  }

  get root(): string {
    return this.library.root;
  }

  /** Runs imports one after another, so two never write the same library folder at once. */
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
              // A failed refresh is fine as long as earlier images are still there.
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

  /** Sources that need importing: new ones, edited ones, and URLs that may be refreshed now. */
  private pending(settings: UshiroeSettings, startup: boolean): ImageSource[] {
    return settings.sources.filter((source) => {
      if (source.type === "url" && startup && source.refresh === "startup") {
        return true;
      }
      return (
        this.library.isStale(source) &&
        (source.type !== "url" || !this.triedUrls.has(`${source.id}|${source.path}`))
      );
    });
  }

  /** At startup: imports what is missing, downloads URLs set to refresh, drops removed sources. */
  async startup(settings: UshiroeSettings = readSettings()): Promise<void> {
    await this.library.prune(settings.sources).catch(() => undefined);
    await this.sync(this.pending(settings, true), {
      refreshUrls: (source) => source.refresh === "startup",
      visible: false,
    });
    this.watchLibrary();
  }

  /** After a settings change: imports new or edited sources and removes deleted ones. */
  async settingsChanged(settings: UshiroeSettings = readSettings()): Promise<void> {
    await this.library.prune(settings.sources).catch(() => undefined);
    await this.sync(this.pending(settings, false), { refreshUrls: () => false, visible: false });
    this.watchLibrary();
    this.changed.fire();
  }

  /** Downloads every URL source again, reporting each failure. */
  async refreshAll(): Promise<void> {
    const urls = readSettings().sources.filter((source) => source.type === "url");
    await this.sync(urls, { refreshUrls: () => true, visible: true });
  }

  /** Downloads one URL source again. */
  async refreshSource(id: unknown): Promise<void> {
    const source = this.find(id);
    if (source?.type === "url") {
      await this.sync([source], { refreshUrls: () => true, visible: true });
    }
  }

  private find(id: unknown): ImageSource | undefined {
    return readSettings().sources.find((candidate) => candidate.id === id);
  }

  /** Lets the user pick image files and copies them into an existing source. */
  async addImagesTo(id: unknown): Promise<void> {
    const source = this.find(id);
    if (!source || source.type === "url") {
      return;
    }
    const files = await window.showOpenDialog({
      canSelectMany: true,
      openLabel: l10n.t("Add Images"),
      filters: { [l10n.t("Images")]: IMAGE_EXTENSIONS.map((extension) => extension.slice(1)) },
    });
    if (!files?.length) {
      return;
    }
    await this.enqueue(async () => {
      try {
        await this.library.addImages(
          source,
          files.map((file) => file.fsPath)
        );
      } catch (error) {
        void window.showWarningMessage(l10n.t("UshiroE could not copy some images."), {
          detail: error instanceof Error ? error.message : String(error),
        });
      }
      this.changed.fire();
    });
  }

  /** Opens a source's folder in the library, where images can also be added by hand. */
  async openSourceFolder(id: unknown): Promise<void> {
    const source = this.find(id);
    const dir = source ? this.library.dirFor(source.id) : this.root;
    await fs.promises.mkdir(dir, { recursive: true });
    await env.openExternal(Uri.file(dir));
  }

  /**
   * Lets the user pick another library folder. Sources are imported again into the new folder
   * by the settings change that follows; the old folder is left as it is.
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

  /** Watches the library folder, so images added to or removed from it by hand show up. */
  private watchLibrary(): void {
    const root = this.root;
    if (root === this.watchedRoot) {
      return;
    }
    this.watchedRoot = root;
    this.watcher?.dispose();
    this.watcher = workspace.createFileSystemWatcher(new RelativePattern(Uri.file(root), "**/*"));
    // Copying many files fires many events; wait for them to settle before refreshing once.
    const refresh = () => {
      clearTimeout(this.watchTimer);
      this.watchTimer = setTimeout(() => this.changed.fire(), 500);
    };
    this.watcher.onDidCreate(refresh);
    this.watcher.onDidDelete(refresh);
  }

  dispose(): void {
    clearTimeout(this.watchTimer);
    this.watcher?.dispose();
    this.changed.dispose();
  }
}
