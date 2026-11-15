import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DownloadError, isDownloadableUrl, sniffImageExtension } from "../src/core/downloads";
import { ImageLibrary } from "../src/core/library";
import type { ImageSource } from "../src/core/model";
import { parseXdgPictures } from "../src/core/picturesDir";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9]);

function source(patch: Partial<ImageSource>): ImageSource {
  return {
    id: "src",
    name: "src",
    type: "file",
    path: "",
    description: "",
    random: false,
    interval: 10,
    recursive: false,
    refresh: "never",
    ...patch,
  };
}

function fakeFetch(body: Uint8Array, status = 200): typeof fetch {
  return (async () => new Response(body as BodyInit, { status })) as unknown as typeof fetch;
}

describe("ImageLibrary", () => {
  let work: string;
  let originals: string;
  let library: ImageLibrary;

  beforeEach(() => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), "ushiroe-lib-"));
    originals = path.join(work, "元画像 フォルダ");
    fs.mkdirSync(path.join(originals, "sub"), { recursive: true });
    fs.writeFileSync(path.join(originals, "背景2.png"), PNG);
    fs.writeFileSync(path.join(originals, "背景10.jpg"), JPEG);
    fs.writeFileSync(path.join(originals, "メモ.txt"), "not an image");
    fs.writeFileSync(path.join(originals, "sub", "深い.png"), PNG);
    library = new ImageLibrary(path.join(work, "library"));
  });

  afterEach(() => fs.rmSync(work, { recursive: true, force: true }));

  it("copies a file under an ASCII name and keeps it when the original disappears", async () => {
    const file = source({ path: path.join(originals, "背景2.png") });
    expect(library.isStale(file)).toBe(true);
    await library.sync(file, false);
    const [copy] = library.images(file);
    expect(path.basename(copy)).toMatch(/^[0-9a-f]{16}\.png$/);
    expect(fs.readFileSync(copy)).toEqual(Buffer.from(PNG));
    expect(library.isStale(file)).toBe(false);

    fs.rmSync(file.path);
    await expect(library.sync(file, false)).rejects.toThrow();
    expect(library.images(file)).toEqual([copy]);
  });

  it("mirrors a folder in natural order and follows additions and removals", async () => {
    const folder = source({ type: "folder", path: originals });
    await library.sync(folder, false);
    expect(library.images(folder)).toHaveLength(2);

    fs.writeFileSync(path.join(originals, "背景3.png"), PNG);
    fs.rmSync(path.join(originals, "背景10.jpg"));
    await library.sync(folder, false);
    const images = library.images(folder);
    expect(images.map((file) => path.extname(file))).toEqual([".png", ".png"]);
    expect(fs.readdirSync(library.dirFor("src"))).toHaveLength(3);

    const recursive = { ...folder, recursive: true };
    expect(library.isStale(recursive)).toBe(true);
    await library.sync(recursive, false);
    expect(library.images(recursive)).toHaveLength(3);
  });

  it("downloads a URL once and again only when asked", async () => {
    let calls = 0;
    const counting = (async () => {
      calls++;
      return new Response((calls === 1 ? PNG : JPEG) as BodyInit);
    }) as unknown as typeof fetch;
    const lib = new ImageLibrary(path.join(work, "library"), counting);
    const url = source({ type: "url", path: "https://example.com/a" });

    await lib.sync(url, false);
    await lib.sync(url, false);
    expect(calls).toBe(1);
    expect(path.extname(lib.images(url)[0])).toBe(".png");

    await lib.sync(url, true);
    expect(calls).toBe(2);
    expect(lib.images(url)).toHaveLength(1);
    expect(path.extname(lib.images(url)[0])).toBe(".jpg");
  });

  it("rejects responses that are not images or not successful", async () => {
    const url = source({ type: "url", path: "https://example.com/a" });
    await expect(
      new ImageLibrary(library.root, fakeFetch(new TextEncoder().encode("<html>"))).sync(url, true)
    ).rejects.toBeInstanceOf(DownloadError);
    await expect(
      new ImageLibrary(library.root, fakeFetch(PNG, 404)).sync(url, true)
    ).rejects.toBeInstanceOf(DownloadError);
  });

  it("hashes unsafe source ids into the folder name", () => {
    expect(path.basename(library.dirFor("abc_1-2"))).toBe("abc_1-2");
    expect(path.basename(library.dirFor("../背景"))).toMatch(/^id-[0-9a-f]{16}$/);
  });

  it("prunes only library folders of removed sources", async () => {
    const keep = source({ id: "keep", path: path.join(originals, "背景2.png") });
    const drop = source({ id: "drop", path: path.join(originals, "背景2.png") });
    await library.sync(keep, false);
    await library.sync(drop, false);
    fs.mkdirSync(path.join(library.root, "user-folder"));
    await library.prune([keep]);
    expect(fs.readdirSync(library.root).sort()).toEqual(["keep", "user-folder"]);
  });
});

describe("downloads", () => {
  it("detects image formats from their bytes", () => {
    expect(sniffImageExtension(PNG)).toBe(".png");
    expect(sniffImageExtension(JPEG)).toBe(".jpg");
    expect(sniffImageExtension(new TextEncoder().encode("GIF89a"))).toBe(".gif");
    expect(sniffImageExtension(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe(".webp");
    expect(sniffImageExtension(new TextEncoder().encode('<?xml version="1.0"?><svg/>'))).toBe(
      ".svg"
    );
    expect(sniffImageExtension(new TextEncoder().encode("<html><body>"))).toBeNull();
  });

  it("accepts only http and https URLs", () => {
    expect(isDownloadableUrl("https://example.com/a.png")).toBe(true);
    expect(isDownloadableUrl("http://example.com/a.png")).toBe(true);
    expect(isDownloadableUrl("file:///C:/a.png")).toBe(false);
    expect(isDownloadableUrl("not a url")).toBe(false);
  });
});

describe("parseXdgPictures", () => {
  it("expands $HOME and ignores a disabled entry", () => {
    expect(parseXdgPictures('XDG_PICTURES_DIR="$HOME/画像"\n', "/home/u")).toBe("/home/u/画像");
    expect(parseXdgPictures('XDG_PICTURES_DIR="$HOME/"\n', "/home/u")).toBeNull();
    expect(parseXdgPictures('XDG_MUSIC_DIR="$HOME/Music"\n', "/home/u")).toBeNull();
  });
});
