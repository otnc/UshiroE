import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { activeAreas, defaultSettings } from "../src/core/model";
import { areaToConfigValue, normalizeSettings } from "../src/core/normalize";
import { buildLiveConfig, isAllowedRemoteUrl, listFolderImages, toWorkbenchUrl } from "../src/core/resolve";
import { buildCss, sanitizePosition } from "../src/runtime/css";

describe("normalizeSettings", () => {
    it("falls back to defaults for missing or invalid values", () => {
        const settings = normalizeSettings({ mode: "nope", sources: "x", fullscreen: { opacity: 7, size: "huge" } });
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
        expect(areaToConfigValue("fullscreen", settings.areas.fullscreen)).not.toHaveProperty("enabled");
        expect(areaToConfigValue("editor", settings.areas.editor)).toHaveProperty("enabled", false);
        const again = normalizeSettings({
            ...settings,
            ...Object.fromEntries(Object.entries(settings.areas).map(([id, area]) => [id, areaToConfigValue(id as never, area)])),
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
        expect((await listFolderImages(dir, false)).map((file) => path.basename(file))).toEqual(["img2.JPG", "img10.png"]);
        expect(await listFolderImages(dir, true)).toHaveLength(3);
    });

    it("builds vscode-file URLs with encoded characters", () => {
        const url = toWorkbenchUrl(path.join(dir, "背景 1.png"));
        expect(url.startsWith("vscode-file://vscode-app/")).toBe(true);
        expect(url).not.toMatch(/[\s背]/);
    });

    it("only allows https remote images", () => {
        expect(isAllowedRemoteUrl("https://example.com/a.png")).toBe(true);
        expect(isAllowedRemoteUrl("http://example.com/a.png")).toBe(false);
        expect(isAllowedRemoteUrl("javascript:alert(1)")).toBe(false);
    });

    it("builds the live config only for active areas with images", async () => {
        const settings = normalizeSettings({
            enabled: true,
            mode: "parts",
            sources: [
                { id: "folder", type: "folder", path: dir, interval: 5, random: true },
                { id: "missing", type: "file", path: path.join(dir, "missing.png") },
            ],
            editor: { enabled: true, source: "folder", opacity: 0.3 },
            sidebar: { enabled: true, source: "missing" },
        });
        const live = await buildLiveConfig(settings, 4);
        expect(live.enabled).toBe(true);
        expect(live.cycle).toBe(4);
        expect(live.areas).toHaveLength(1);
        expect(live.areas[0]).toMatchObject({ id: "editor", opacity: 0.3, random: true, interval: 5000 });
        expect(live.areas[0].images).toHaveLength(2);
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

    it("cannot be broken out of by a custom position", () => {
        expect(sanitizePosition("center; } body { display: none")).toBe("center  body  display: none");
        expect(sanitizePosition(";;")).toBe("center");
    });
});
