import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { fetchImage } from "./downloads";
import { MAX_FOLDER_IMAGES, isSupportedImage, listFolderImages, naturalCompare } from "./files";
import type { ImageSource } from "./model";

const MANIFEST = "manifest.json";
const MANIFEST_VERSION = 1;

/** What a source folder in the library holds, in display order. */
interface Manifest {
  version: number;
  /** The source's `path` and options when it was imported, to notice when the user changes them. */
  origin: string;
  recursive: boolean;
  files: string[];
}

function shortHash(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

/** File names only ever use ASCII, so the copies never depend on how a path is encoded. */
function copyName(key: string, extension: string): string {
  return `${shortHash(key)}${extension.toLowerCase()}`;
}

/**
 * Every image UshiroE shows lives in its library folder, `<Pictures>/UshiroE/<source>/`.
 * Files and folders are copied in once, when they are added, and are not linked to their
 * original afterwards; URLs are downloaded again only when asked to. Images the user puts into a
 * source's folder directly are shown as well.
 */
export class ImageLibrary {
  constructor(
    readonly root: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  /** Source ids are user-editable, so anything beyond safe characters is hashed. */
  dirFor(sourceId: string): string {
    const safe = /^[A-Za-z0-9_-]{1,64}$/.test(sourceId) ? sourceId : `id-${shortHash(sourceId)}`;
    return path.join(this.root, safe);
  }

  private readManifest(sourceId: string): Manifest | null {
    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(this.dirFor(sourceId), MANIFEST), "utf8")
      ) as Manifest;
      return data.version === MANIFEST_VERSION && Array.isArray(data.files) ? data : null;
    } catch {
      return null;
    }
  }

  private async writeManifest(
    source: ImageSource,
    files: string[],
    origin = this.readManifest(source.id)
  ): Promise<void> {
    const manifest: Manifest = {
      version: MANIFEST_VERSION,
      origin: origin?.origin ?? source.path,
      recursive: origin?.recursive ?? source.recursive,
      files,
    };
    await fs.promises.writeFile(
      path.join(this.dirFor(source.id), MANIFEST),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );
  }

  /**
   * The images of a source in display order: the imported ones first, then any image the user
   * dropped into the source's folder. Empty until the source has been imported.
   */
  images(source: ImageSource): string[] {
    const manifest = this.readManifest(source.id);
    if (!manifest) {
      return [];
    }
    const dir = this.dirFor(source.id);
    const listed = new Set(manifest.files);
    let extra: string[] = [];
    try {
      extra = fs
        .readdirSync(dir)
        .filter((name) => !listed.has(name) && isSupportedImage(name))
        .sort(naturalCompare);
    } catch {
      // The folder was removed; nothing to show.
    }
    return [...manifest.files, ...extra]
      .map((file) => path.join(dir, file))
      .filter((file) => fs.existsSync(file))
      .slice(0, MAX_FOLDER_IMAGES);
  }

  /**
   * True when the source has never been imported, or when its path or options were changed,
   * for example in `settings.json`, so it should be imported again.
   */
  isStale(source: ImageSource): boolean {
    const manifest = this.readManifest(source.id);
    return (
      manifest === null ||
      manifest.origin !== source.path ||
      (source.type === "folder" && manifest.recursive !== source.recursive)
    );
  }

  /**
   * Imports a source. Files and folders are copied and replace whatever an earlier import of
   * the same source left; a URL is downloaded when `refreshUrl` is set or nothing was
   * downloaded for it yet. When the original is unreachable the folder stays as it was.
   */
  async sync(source: ImageSource, refreshUrl: boolean): Promise<void> {
    const dir = this.dirFor(source.id);
    await fs.promises.mkdir(dir, { recursive: true });
    let files: string[];
    switch (source.type) {
      case "file":
        files = [await this.copyFile(source.path, dir)];
        break;
      case "folder": {
        files = [];
        for (const file of await listFolderImages(source.path, source.recursive)) {
          files.push(await this.copyFile(file, dir));
        }
        break;
      }
      case "url": {
        if (!refreshUrl && !this.isStale(source) && this.images(source).length > 0) {
          return;
        }
        const { bytes, extension } = await fetchImage(source.path, this.fetchImpl);
        const name = copyName(`${source.path}\n${shortHash(bytes)}`, extension);
        await fs.promises.writeFile(path.join(dir, name), bytes);
        files = [name];
        break;
      }
    }
    await this.writeManifest(source, files, null);
    await this.removeUnlisted(dir, files);
  }

  /** Copies more images into a source, after the ones it already has. Returns how many. */
  async addImages(source: ImageSource, files: readonly string[]): Promise<number> {
    const manifest = this.readManifest(source.id);
    const dir = this.dirFor(source.id);
    await fs.promises.mkdir(dir, { recursive: true });
    const names = [...(manifest?.files ?? [])];
    let added = 0;
    for (const file of files) {
      const name = await this.copyFile(file, dir);
      if (!names.includes(name)) {
        names.push(name);
        added++;
      }
    }
    await this.writeManifest(source, names, manifest ?? null);
    return added;
  }

  private async removeUnlisted(dir: string, files: string[]): Promise<void> {
    const keep = new Set([MANIFEST, ...files]);
    for (const entry of await fs.promises.readdir(dir)) {
      if (!keep.has(entry)) {
        await fs.promises.rm(path.join(dir, entry), { force: true });
      }
    }
  }

  /**
   * Copies one image unless an identical copy exists. The copy is named after the original
   * path, size and modification time, so copying the same file twice keeps one copy.
   */
  private async copyFile(file: string, dir: string): Promise<string> {
    if (!isSupportedImage(file)) {
      throw new Error(`Unsupported image format: ${file}`);
    }
    const stat = await fs.promises.stat(file);
    const name = copyName(`${file}\n${stat.size}\n${stat.mtimeMs}`, path.extname(file));
    const target = path.join(dir, name);
    if (!fs.existsSync(target)) {
      await fs.promises.copyFile(file, target);
    }
    return name;
  }

  /**
   * Deletes the library folders of sources that no longer exist. Only folders that hold a
   * manifest are touched, so anything else the user keeps under `UshiroE/` is left alone.
   */
  async prune(sources: readonly ImageSource[]): Promise<void> {
    const keep = new Set(sources.map((source) => path.basename(this.dirFor(source.id))));
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(this.root, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const dir = path.join(this.root, entry.name);
      if (entry.isDirectory() && !keep.has(entry.name) && fs.existsSync(path.join(dir, MANIFEST))) {
        await fs.promises.rm(dir, { recursive: true, force: true });
      }
    }
  }
}
