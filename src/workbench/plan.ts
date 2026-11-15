import { applyPatch, replaceChecksum, stripBackImage, stripUshiroe, vscodeChecksum } from "./patch";
import { WORKBENCH_SCRIPT_KEY } from "./paths";

export interface WorkbenchFiles {
  script: string;
  /** `product.json`, or null when it could not be read. */
  product: string | null;
}

/** New contents for the files that change; a missing key means the file stays as it is. */
export interface WorkbenchEdit {
  script?: string;
  product?: string;
}

/** Points `product.json`'s checksum at `checksummed` and keeps only the files that changed. */
function finish(files: WorkbenchFiles, script: string, checksummed: string): WorkbenchEdit {
  const edit: WorkbenchEdit = {};
  if (script !== files.script) {
    edit.script = script;
  }
  if (files.product !== null) {
    const product = replaceChecksum(
      files.product,
      WORKBENCH_SCRIPT_KEY,
      vscodeChecksum(checksummed)
    );
    if (product !== null && product !== files.product) {
      edit.product = product;
    }
  }
  return edit;
}

/**
 * Installs `block` in place of any UshiroE or BackImage block. Matching the checksum to the
 * patched script hides VS Code's "installation appears to be corrupt" notice; matching it to
 * the original script keeps VS Code's own integrity check meaningful.
 */
export function planApply(
  files: WorkbenchFiles,
  block: string,
  hideCorruptWarning: boolean
): WorkbenchEdit {
  const patched = applyPatch(files.script, block);
  const original = stripBackImage(stripUshiroe(files.script));
  return finish(files, patched, hideCorruptWarning ? patched : original);
}

/** Removes the UshiroE block and restores the checksum of what remains. */
export function planRemove(files: WorkbenchFiles): WorkbenchEdit {
  const restored = stripUshiroe(files.script);
  return finish(files, restored, restored);
}

/** Removes BackImage's block. The checksum is only touched when the script changes. */
export function planRemoveBackImage(files: WorkbenchFiles): WorkbenchEdit {
  const cleaned = stripBackImage(files.script);
  return cleaned === files.script ? {} : finish(files, cleaned, cleaned);
}
