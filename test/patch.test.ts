import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
    applyPatch,
    buildPatchBlock,
    inspectPatch,
    replaceChecksum,
    stripBackImage,
    stripUshiroe,
    vscodeChecksum,
} from "../src/workbench/patch";

const ORIGINAL = "console.log('workbench');\n//# sourceMappingURL=https://example.com/main.js.map";
const RUNTIME = "var __ushiroeRuntime=(()=>({start(){}}))();";
const BOOT = { configUrl: "vscode-file://vscode-app/c%3A/live.json", pollInterval: 1500 };

function backImageBlock(version = "1.1.6"): string {
    const hash = createHash("sha256").update("x").digest("hex");
    return `\n//backimage.${version}-${hash}\n;(function(){document.title="bg"})();\n//END.backimage.${version}`;
}

describe("buildPatchBlock", () => {
    it("is stable for the same input and changes with the boot options", () => {
        const a = buildPatchBlock(RUNTIME, BOOT);
        expect(buildPatchBlock(RUNTIME, BOOT)).toEqual(a);
        expect(buildPatchBlock(RUNTIME, { ...BOOT, pollInterval: 1000 }).hash).not.toBe(a.hash);
        expect(a.block).toContain(JSON.stringify(BOOT));
    });

    it("rejects a runtime that contains the end marker", () => {
        expect(() => buildPatchBlock("/* ushiroe:end */", BOOT)).toThrow();
    });
});

describe("applyPatch / stripUshiroe", () => {
    it("restores the original content byte for byte", () => {
        const { block } = buildPatchBlock(RUNTIME, BOOT);
        const patched = applyPatch(ORIGINAL, block);
        expect(patched.startsWith(ORIGINAL)).toBe(true);
        expect(stripUshiroe(patched)).toBe(ORIGINAL);
    });

    it("replaces an older UshiroE block instead of stacking blocks", () => {
        const old = buildPatchBlock(RUNTIME, { ...BOOT, pollInterval: 999 });
        const next = buildPatchBlock(RUNTIME, BOOT);
        const patched = applyPatch(applyPatch(ORIGINAL, old.block), next.block);
        expect(patched).toBe(ORIGINAL + next.block);
        expect(inspectPatch(patched).hash).toBe(next.hash);
    });

    it("removes BackImage's block while patching", () => {
        const withBackImage = ORIGINAL + backImageBlock();
        expect(inspectPatch(withBackImage).hasBackImage).toBe(true);
        const { block } = buildPatchBlock(RUNTIME, BOOT);
        const patched = applyPatch(withBackImage, block);
        expect(patched).toBe(ORIGINAL + block);
        expect(inspectPatch(patched)).toEqual({ hash: expect.any(String), hasBackImage: false });
    });

    it("leaves other content untouched when nothing is installed", () => {
        expect(stripUshiroe(ORIGINAL)).toBe(ORIGINAL);
        expect(stripBackImage(ORIGINAL)).toBe(ORIGINAL);
        expect(inspectPatch(ORIGINAL)).toEqual({ hash: null, hasBackImage: false });
    });
});

describe("checksums", () => {
    it("matches VS Code's format: sha256, base64, no padding", () => {
        const expected = createHash("sha256").update("abc").digest("base64").replace(/=+$/, "");
        expect(vscodeChecksum("abc")).toBe(expected);
        expect(vscodeChecksum("abc")).not.toMatch(/=$/);
    });

    it("rewrites only the requested entry and keeps formatting", () => {
        const product = `{\n\t"checksums": {\n\t\t"vs/workbench/workbench.desktop.main.js": "OLD",\n\t\t"vs/workbench/workbench.desktop.main.css": "CSS"\n\t}\n}`;
        const updated = replaceChecksum(product, "vs/workbench/workbench.desktop.main.js", "NEW+/x");
        expect(updated).toBe(product.replace("OLD", "NEW+/x"));
        expect(replaceChecksum(product, "missing/key.js", "x")).toBeNull();
    });
});
