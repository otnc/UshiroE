import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listFolderImages, toWorkbenchUrl } from "../src/core/files";
import { ALL_SOURCES, activeAreas, defaultSettings } from "../src/core/model";
import { areaToConfigValue, normalizeSettings } from "../src/core/normalize";
import { buildLiveConfig } from "../src/core/resolve";
import { buildCss, sanitizePosition } from "../src/runtime/css";

describe("normalizeSettings", () => {
  it("falls back to defaults for missing or invalid values", () => {
    const settings = normalizeSettings({
      mode: "nope",
      sources: "x",
      fullscreen: { opacity: 7, size: "huge" },
    });
    expect(settings.mode).toBe("fullscreen");
    expect(settings.sources).toEqual([]);
    expect(settings.areas.fullscreen.opacity).toBe(1);
    expect(settings.areas.fullscreen.size).toBe("cover");
  });

  it("clears area sources that point at removed sources", () => {
    const settings = normalizeSettings({
      sources: [{ id: "a", type: "file", path: "/a.png" }],
      editor: { enabled: true, source: "gone" },
      panel: { enabled: true, source: "a" },
    });
    expect(settings.areas.editor.source).toBeNull();
    expect(settings.areas.panel.source).toBe("a");
  });

  it("round-trips through the settings.json shape", () => {
    const settings = defaultSettings();
    expect(areaToConfigValue("fullscreen", settings.areas.fullscreen)).not.toHaveProperty(
      "enabled"
    );
    expect(areaToConfigValue("editor", settings.areas.editor)).toHaveProperty("enabled", false);
    const again = normalizeSettings({
      ...settings,
      ...Object.fromEntries(
        Object.entries(settings.areas).map(([id, area]) => [
          id,
          areaToConfigValue(id as never, area),
        ])
      ),
    });
    expect(again).toEqual(settings);
  });
});

describe("activeAreas", () => {
  it("depends on the mode and on which parts have an image", () => {
    const settings = defaultSettings();
    settings.enabled = true;
    settings.areas.fullscreen.source = "x";
    settings.areas.editor = { ...settings.areas.editor, enabled: true, source: "x" };
    settings.areas.panel = { ...settings.areas.panel, enabled: true, source: null };
    expect(activeAreas(settings)).toEqual(["fullscreen"]);
    settings.mode = "parts";
    expect(activeAreas(settings)).toEqual(["editor"]);
    settings.enabled = false;
    expect(activeAreas(settings)).toEqual([]);
  });
});

describe("resolve", () => {
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ushiroe-test-"));
    fs.mkdirSync(path.join(dir, "nested"));
    for (const name of ["img10.png", "img2.JPG", "notes.txt", "icon.ico", "nested/deep.webp"]) {
      fs.writeFileSync(path.join(dir, name), "");
    }
  });

  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("lists supported images in natural order, optionally recursively", async () => {
    expect((await listFolderImages(dir, false)).map((file) => path.basename(file))).toEqual([
      "img2.JPG",
      "img10.png",
    ]);
    expect(await listFolderImages(dir, true)).toHaveLength(3);
  });

  it("builds vscode-file URLs with encoded characters", () => {
    const url = toWorkbenchUrl(path.join(dir, "背景 1.png"));
    expect(url.startsWith("vscode-file://vscode-app/")).toBe(true);
    expect(url).not.toMatch(/[\s背]/);
  });
});

describe("buildLiveConfig", () => {
  const copies: Record<string, string[]> = {
    folder: ["/lib/folder/a.png", "/lib/folder/b.png"],
    file: ["/lib/file/c.png"],
    missing: [],
  };
  const resolver = {
    imagesOf: (source: { id: string }) => copies[source.id] ?? [],
    fileOf: (ref: string) => {
      const [id, name] = ref.split("/");
      return copies[id]?.find((file) => file.endsWith(`/${name}`)) ?? null;
    },
  };
  const sources = [
    { id: "folder", type: "folder", path: "/pics", interval: 5, random: true },
    { id: "file", type: "file", path: "/c.png" },
    { id: "missing", type: "file", path: "/missing.png" },
  ];

  it("includes only active areas that have images", () => {
    const settings = normalizeSettings({
      enabled: true,
      mode: "parts",
      sources,
      editor: { enabled: true, source: "folder", opacity: 0.3 },
      sidebar: { enabled: true, source: "missing" },
    });
    const live = buildLiveConfig(settings, 4, resolver);
    expect(live.enabled).toBe(true);
    expect(live.cycle).toBe(4);
    expect(live.areas).toHaveLength(1);
    expect(live.areas[0]).toMatchObject({
      id: "editor",
      opacity: 0.3,
      random: true,
      interval: 5000,
      changeOnStartupOnly: false,
    });
    expect(live.areas[0].images).toEqual(copies.folder.map(toWorkbenchUrl));
  });

  it("plays all images in source order with the All images rotation", () => {
    const settings = normalizeSettings({
      enabled: true,
      sources: [sources[1], sources[0]],
      allImages: { random: false, interval: 30 },
      fullscreen: { source: ALL_SOURCES },
    });
    const [area] = buildLiveConfig(settings, 0, resolver).areas;
    expect(area).toMatchObject({ id: "fullscreen", random: false, interval: 30000 });
    expect(area.images).toEqual([...copies.file, ...copies.folder].map(toWorkbenchUrl));
  });

  it("defaults All images to random every 60 seconds", () => {
    expect(normalizeSettings({}).allImages).toEqual({
      random: true,
      interval: 60,
      changeOnStartupOnly: false,
    });
  });

  it("plays a preset in its own order and skips images that are gone", () => {
    const settings = normalizeSettings({
      enabled: true,
      sources,
      presets: [
        {
          id: "p",
          name: "Favorites",
          images: ["folder/b.png", "missing/x.png", "file/c.png", "folder/a.png"],
          changeOnStartupOnly: true,
          interval: 5,
        },
      ],
      fullscreen: { source: "preset:p" },
    });
    const [area] = buildLiveConfig(settings, 0, resolver).areas;
    expect(area.images).toEqual(
      ["/lib/folder/b.png", "/lib/file/c.png", "/lib/folder/a.png"].map(toWorkbenchUrl)
    );
    // Changing only at startup means no timer while VS Code runs.
    expect(area).toMatchObject({ changeOnStartupOnly: true, interval: 0 });
  });

  it("forgets areas that point at a deleted preset", () => {
    const settings = normalizeSettings({ sources, fullscreen: { source: "preset:gone" } });
    expect(settings.areas.fullscreen.source).toBeNull();
  });
});

describe("buildCss", () => {
  const area = {
    id: "editor" as const,
    images: ["vscode-file://vscode-app/a.png"],
    opacity: 0.2,
    size: "cover" as const,
    position: "center",
    blur: 0,
    random: false,
    interval: 0,
  };

  it("is empty when disabled", () => {
    expect(buildCss({ v: 1, enabled: false, transition: 1, areas: [area], cycle: 0 })).toBe("");
  });

  it("targets the part with a pseudo element that ignores the mouse", () => {
    const css = buildCss({ v: 1, enabled: true, transition: 1, areas: [area], cycle: 0 });
    expect(css).toContain("[id='workbench.parts.editor']::before");
    expect(css).toContain("pointer-events: none");
    expect(css).toContain("var(--ushiroe-editor-image)");
  });

  it("keeps the full-window layer below the title bar, also when blurred", () => {
    const fullscreen = { ...area, id: "fullscreen" as const };
    const plain = buildCss({ v: 1, enabled: true, transition: 1, areas: [fullscreen], cycle: 0 });
    expect(plain).toContain("top: var(--ushiroe-titlebar-height, 0px)");
    const blurred = buildCss({
      v: 1,
      enabled: true,
      transition: 1,
      areas: [{ ...fullscreen, blur: 5 }],
      cycle: 0,
    });
    expect(blurred).toContain("top: calc(var(--ushiroe-titlebar-height, 0px) - 10px)");
    expect(blurred).toContain("clip-path: inset(10px 0 0 0)");
  });

  it("cannot be broken out of by a custom position", () => {
    expect(sanitizePosition("center; } body { display: none")).toBe("center  body  display: none");
    expect(sanitizePosition(";;")).toBe("center");
  });
});
