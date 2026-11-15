import { inspectPatch, stripBackImage, stripUshiroe, ushiroeBlocks, vscodeChecksum } from "./patch";

/** VS Code's workbench script is over 20 MB; anything this small is truncated. */
export const MIN_SCRIPT_BYTES = 1024 * 1024;

export interface IntegrityInput {
  script: string;
  /** The script's checksum in `product.json`, or null when it has none. */
  productChecksum: string | null;
  /** The pristine checksum UshiroE recorded for this VS Code commit, if any. */
  recordedOriginal: string | null;
  minBytes?: number;
}

export type IntegrityFailure = "truncated" | "modified";

export type IntegrityResult =
  | {
      ok: true;
      /** The script without UshiroE and BackImage blocks. */
      base: string;
      baseChecksum: string;
      /** The base is VS Code's own file, so its checksum can be recorded as the original. */
      basePristine: boolean;
    }
  | { ok: false; reason: IntegrityFailure };

/**
 * Decides whether a workbench script is a known-good base that UshiroE may patch or restore.
 * Patching anything else could stack on a truncated or foreign-modified file, and hiding the
 * checksum would then hide real corruption.
 */
export function checkIntegrity(input: IntegrityInput): IntegrityResult {
  const base = stripBackImage(stripUshiroe(input.script));
  const lastLine = base.trimEnd().split("\n").pop() ?? "";
  if (
    Buffer.byteLength(base, "utf8") < (input.minBytes ?? MIN_SCRIPT_BYTES) ||
    !lastLine.startsWith("//# sourceMappingURL=")
  ) {
    return { ok: false, reason: "truncated" };
  }
  const baseChecksum = vscodeChecksum(base);
  if (baseChecksum === input.productChecksum || baseChecksum === input.recordedOriginal) {
    return { ok: true, base, baseChecksum, basePristine: true };
  }
  // UshiroE's own earlier patch with hideCorruptWarning: the checksum covers the whole script.
  const blocks = ushiroeBlocks(input.script);
  if (
    input.productChecksum !== null &&
    vscodeChecksum(input.script) === input.productChecksum &&
    blocks.length === 1 &&
    blocks[0].valid &&
    !inspectPatch(input.script).hasBackImage
  ) {
    return { ok: true, base, baseChecksum, basePristine: false };
  }
  return { ok: false, reason: "modified" };
}

export class IntegrityError extends Error {
  constructor(readonly reason: IntegrityFailure) {
    super(
      reason === "truncated"
        ? "VS Code's workbench file looks truncated or damaged. Reinstall VS Code, or see UshiroE's troubleshooting steps."
        : "VS Code's workbench file was changed by something other than UshiroE. Reinstall VS Code, or see UshiroE's troubleshooting steps."
    );
    this.name = "IntegrityError";
  }
}
