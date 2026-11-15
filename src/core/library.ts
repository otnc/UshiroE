import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { fetchImage } from "./downloads";
import type { ImageSource } from "./model";
import { MAX_FOLDER_IMAGES, isSupportedImage, listFolderImages } from "./files";

const MANIFEST = "manifest.json";
const MANIFEST_VERSION = 1;

/** What a source folder in the library holds, in display order. */
interface Manifest {
  version: number;
  /** The source's `path` and options at the time of the copy, to detect edits. */
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
 * Every image UshiroE shows is a copy in its library folder, `<Pictures>/UshiroE/<source>/`,
 * whatever the source is: a file, a folder, a URL or an image imported from BackImage. The
 * workbench then only ever loads files with short ASCII names from one place, and the
 * background keeps working when the original file is moved or deleted.
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

  private async writeManifest(source: ImageSource, files: string[]): Promise<void> {
    const dir = this.dirFor(source.id);
    const manifest: Manifest = {
      version: MANIFEST_VERSION,
      origin: source.path,
      recursive: source.recursive,
      files,
    };
    await fs.promises.writeFile(
      path.join(dir, MANIFEST),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );
    // Drop copies that are no longer listed, such as images removed from a source folder.
    const keep = new Set([MANIFEST, ...files]);
    for (const entry of await fs.promises.readdir(dir)) {
      if (!keep.has(entry)) {
        await fs.promises.rm(path.join(dir, entry), { force: true });
      }
    }
  }

  /** Copies in display order; empty until the source has been synced once. */
  images(source: ImageSource): string[] {
    const manifest = this.readManifest(source.id);
    if (!manifest) {
      return [];
    }
    const dir = this.dirFor(source.id);
    return manifest.files.map((file) => path.join(dir, file)).filter((file) => fs.existsSync(file));
  }

  /** True when the copies do not reflect the source's current path or options. */
  isStale(source: ImageSource): boolean {
    const manifest = this.readManifest(source.id);
    return (
      manifest === null ||
      manifest.origin !== source.path ||
      (source.type === "folder" && manifest.recursive !== source.recursive)
    );
  }

  /**
   * Brings the copies up to date. Local files are only copied when they changed; a URL is
   * downloaded when `refreshUrl` is set or nothing was downloaded for it yet. When the
   * original is unreachable the previous copies stay in place.
   */
  async sync(source: ImageSource, refreshUrl: boolean): Promise<void> {
    const dir = this.dirFor(source.id);
    await fs.promises.mkdir(dir, { recursive: true });
    switch (source.type) {
      case "file":
        await this.writeManifest(source, [await this.copyFile(source.path, dir)]);
        return;
      case "folder": {
        const files = await listFolderImages(source.path, source.recursive);
        const copies: string[] = [];
        for (const file of files.slice(0, MAX_FOLDER_IMAGES)) {
          copies.push(await this.copyFile(file, dir));
        }
        await this.writeManifest(source, copies);
        return;
      }
      case "url": {
        if (!refreshUrl && !this.isStale(source) && this.images(source).length > 0) {
          return;
        }
        const { bytes, extension } = await fetchImage(source.path, this.fetchImpl);
        const name = copyName(`${source.path}\n${shortHash(bytes)}`, extension);
        await fs.promises.writeFile(path.join(dir, name), bytes);
        await this.writeManifest(source, [name]);
        return;
      }
    }
  }

  /**
   * Copies one image unless an identical copy exists. The copy is named after the original
   * path, size and modification time, so an edited image gets a new name and the workbench,
   * which caches images by URL, shows the new version.
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
