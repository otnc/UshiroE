import fs from "node:fs";

import { env, l10n, window } from "vscode";

import type { RuntimeBoot } from "./runtime/main";
import { type FileChange, applyChangesDirect, applyChangesElevated } from "./workbench/fileio";
import { buildPatchBlock, inspectPatch } from "./workbench/patch";
import { type WorkbenchPaths, workbenchPaths } from "./workbench/paths";
import {
  type WorkbenchEdit,
  type WorkbenchFiles,
  planApply,
  planRemove,
  planRemoveBackImage,
} from "./workbench/plan";

export type PatchState = "applied" | "outdated" | "missing";

export interface PatchStatus {
  state: PatchState;
  /** BackImage's own patch is still in the workbench script. */
  hasBackImage: boolean;
}

export class CancelledError extends Error {
  constructor() {
    super("Cancelled by the user");
    this.name = "CancelledError";
  }
}

export class Patcher {
  readonly paths: WorkbenchPaths = workbenchPaths(env.appRoot);
  private expected: { block: string; hash: string } | undefined;

  constructor(
    private readonly runtimeFile: string,
    private readonly boot: RuntimeBoot
  ) {}

  private async expectedBlock(): Promise<{ block: string; hash: string }> {
    this.expected ??= buildPatchBlock(
      await fs.promises.readFile(this.runtimeFile, "utf8"),
      this.boot
    );
    return this.expected;
  }

  private async readFiles(): Promise<WorkbenchFiles> {
    const script = await fs.promises.readFile(this.paths.script, "utf8");
    const product = await fs.promises.readFile(this.paths.product, "utf8").catch(() => null);
    return { script, product };
  }

  async status(): Promise<PatchStatus> {
    const [{ hash }, files] = await Promise.all([this.expectedBlock(), this.readFiles()]);
    const info = inspectPatch(files.script);
    const state: PatchState =
      info.hash === null ? "missing" : info.hash === hash ? "applied" : "outdated";
    return { state, hasBackImage: info.hasBackImage };
  }

  /** Installs or updates the patch. Returns whether the workbench script changed. */
  async apply(hideCorruptWarning: boolean): Promise<boolean> {
    const { block } = await this.expectedBlock();
    return this.commit(planApply(await this.readFiles(), block, hideCorruptWarning));
  }

  /** Removes the UshiroE patch and restores the checksum. Returns whether anything was installed. */
  async remove(): Promise<boolean> {
    return this.commit(planRemove(await this.readFiles()));
  }

  existingBackImageBackups(): string[] {
    return this.paths.backImageBackups.filter((file) => fs.existsSync(file));
  }

  /** Deletes BackImage's patch and backup files. Only safe once BackImage is uninstalled. */
  async removeBackImageLeftovers(): Promise<void> {
    const deletions = this.existingBackImageBackups().map((target) => ({ target, content: null }));
    await this.commit(planRemoveBackImage(await this.readFiles()), deletions);
  }

  /** Writes the edit, asking for administrator rights when needed. Returns whether the script changed. */
  private async commit(edit: WorkbenchEdit, extra: FileChange[] = []): Promise<boolean> {
    const changes: FileChange[] = [...extra];
    if (edit.script !== undefined) {
      changes.push({ target: this.paths.script, content: edit.script });
    }
    if (edit.product !== undefined) {
      changes.push({ target: this.paths.product, content: edit.product });
    }
    const denied = await applyChangesDirect(changes);
    if (denied.length > 0) {
      const retry = l10n.t("Retry as Administrator");
      const choice = await window.showWarningMessage(
        l10n.t("UshiroE needs administrator rights to modify VS Code's installation folder."),
        { modal: true, detail: denied.map((change) => change.target).join("\n") },
        retry
      );
      if (choice !== retry) {
        throw new CancelledError();
      }
      await applyChangesElevated(denied);
    }
    return edit.script !== undefined;
  }
}
