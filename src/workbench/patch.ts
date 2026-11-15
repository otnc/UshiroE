import { createHash } from "node:crypto";

import type { RuntimeBoot } from "../runtime/main";

const BEGIN_PREFIX = "/* ushiroe:begin ";
const END_MARKER = "/* ushiroe:end */";

/** Every UshiroE block, including the newline that was added in front of it. */
const USHIROE_BLOCK = /\n?\/\* ushiroe:begin [0-9a-f]+ \*\/\n[\s\S]*?\n\/\* ushiroe:end \*\//g;

/**
 * BackImage appends `\n//backimage.<version>-<sha256>\n<patch>\n//END.backimage.<version>`
 * to the workbench script.
 */
const BACKIMAGE_BLOCK =
  /\n\/\/backimage\.[0-9A-Za-z.-]+\n[\s\S]*?\n\/\/END\.backimage\.[0-9A-Za-z.-]+/g;

export const RUNTIME_GLOBAL = "__ushiroeRuntime";

export interface PatchInfo {
  /** Hash of the installed UshiroE block, or null when none is installed. */
  hash: string | null;
  hasBackImage: boolean;
}

function shortHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/**
 * Wraps the bundled runtime so it starts with the given boot options.
 * The runtime must be an IIFE bundle that assigns {@link RUNTIME_GLOBAL}.
 */
export function buildPatchBlock(
  runtimeCode: string,
  boot: RuntimeBoot
): { block: string; hash: string } {
  if (runtimeCode.includes(END_MARKER)) {
    throw new Error("The runtime bundle must not contain the end marker.");
  }
  const body = `;(function(){${runtimeCode.trim()}\n${RUNTIME_GLOBAL}.start(${JSON.stringify(boot)});})();`;
  const hash = shortHash(body);
  return { block: `\n${BEGIN_PREFIX}${hash} */\n${body}\n${END_MARKER}`, hash };
}

export function inspectPatch(content: string): PatchInfo {
  const match = /\/\* ushiroe:begin ([0-9a-f]+) \*\//.exec(content);
  BACKIMAGE_BLOCK.lastIndex = 0;
  return { hash: match ? match[1] : null, hasBackImage: BACKIMAGE_BLOCK.test(content) };
}

export function stripUshiroe(content: string): string {
  return content.replace(USHIROE_BLOCK, "");
}

export function stripBackImage(content: string): string {
  return content.replace(BACKIMAGE_BLOCK, "");
}

/** Removes old UshiroE and BackImage blocks, then appends the new block at the end. */
export function applyPatch(content: string, block: string): string {
  return stripBackImage(stripUshiroe(content)) + block;
}

/** The checksum format VS Code stores in `product.json` (`sha256`, base64, no padding). */
export function vscodeChecksum(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("base64").replace(/=+$/, "");
}

/**
 * Rewrites one entry of `product.json`'s `checksums` without reformatting the file.
 * Returns null when the file has no checksum for that key.
 */
export function replaceChecksum(productJson: string, key: string, checksum: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const pattern = new RegExp(`("${escapedKey}"\\s*:\\s*")([^"]*)(")`);
  if (!pattern.test(productJson)) {
    return null;
  }
  return productJson.replace(
    pattern,
    (_all, before: string, _old: string, after: string) => before + checksum + after
  );
}
