import fs from "node:fs";

import { env, l10n, window } from "vscode";

import type { RuntimeBoot } from "./runtime/main";
import { type RestoreResult, WorkbenchEditor } from "./workbench/editor";
import { type FileChange, writeElevated } from "./workbench/fileio";
import type { IntegrityFailure } from "./workbench/integrity";
import { buildPatchBlock } from "./workbench/patch";

export type PatchState = "applied" | "outdated" | "missing";

export interface PatchStatus {
  state: PatchState;
  /** Hash of the UshiroE block in the script, whatever version wrote it. */
  blockHash: string | null;
  /** BackImage's block is still in the workbench script. */
  hasBackImage: boolean;
  /** BackImage's `.backup` files are still next to the workbench files. */
  hasBackImageBackups: boolean;
  /** Why the workbench files are not a known-good base, or null when they are. */
  problem: IntegrityFailure | null;
  /** VS Code's build commit. */
  commit: string;
}

async function askElevation(changes: FileChange[]): Promise<boolean> {
  const retry = l10n.t("Retry as Administrator");
  const choice = await window.showWarningMessage(
    l10n.t("UshiroE needs administrator rights to modify VS Code's installation folder."),
    { modal: true, detail: changes.map((change) => change.target).join("\n") },
    retry
  );
  if (choice !== retry) {
    return false;
  }
  await writeElevated(changes);
  return true;
}

/** Builds UshiroE's block and hands every file change to the {@link WorkbenchEditor}. */
export class Patcher {
  readonly editor: WorkbenchEditor;
  private expected: { block: string; hash: string } | undefined;

  constructor(
    private readonly runtimeFile: string,
    private readonly boot: RuntimeBoot,
    stateDir: string
  ) {
    this.editor = new WorkbenchEditor({ appRoot: env.appRoot, stateDir, elevate: askElevation });
  }

  private async expectedBlock(): Promise<{ block: string; hash: string }> {
    this.expected ??= buildPatchBlock(
      await fs.promises.readFile(this.runtimeFile, "utf8"),
      this.boot
    );
    return this.expected;
  }

  async status(): Promise<PatchStatus> {
    const [{ hash }, status] = await Promise.all([this.expectedBlock(), this.editor.status()]);
    return {
      state:
        status.blockHash === null ? "missing" : status.blockHash === hash ? "applied" : "outdated",
      blockHash: status.blockHash,
      hasBackImage: status.hasBackImage,
      hasBackImageBackups: this.editor.existingBackImageBackups().length > 0,
      problem: status.integrity.ok ? null : status.integrity.reason,
      commit: status.commit ?? "unknown",
    };
  }

  /** Installs or updates the patch. Returns whether the workbench script changed. */
  async apply(hideCorruptWarning: boolean): Promise<boolean> {
    return this.editor.apply((await this.expectedBlock()).block, hideCorruptWarning);
  }

  /** Removes the UshiroE patch and restores the checksum. Returns whether anything was installed. */
  remove(): Promise<boolean> {
    return this.editor.remove();
  }

  restore(): Promise<RestoreResult> {
    return this.editor.restore();
  }

  existingBackImageBackups(): string[] {
    return this.editor.existingBackImageBackups();
  }

  removeBackImageLeftovers(hideCorruptWarning: boolean): Promise<void> {
    return this.editor.removeBackImageLeftovers(hideCorruptWarning);
  }
}
