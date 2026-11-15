/**
 * Restores VS Code's workbench files. VS Code runs this as the `vscode:uninstall` hook, with its
 * own executable in Node mode and without the `vscode` API. It also works by hand:
 *
 *   node <extension folder>/dist/uninstall.js [<VS Code install folder>]
 *
 * Without a folder it tries the running executable's install and the usual install locations.
 */
import fs from "node:fs";
import path from "node:path";

import { WorkbenchEditor } from "./workbench/editor";
import { PermissionError } from "./workbench/fileio";
import { IntegrityError } from "./workbench/integrity";
import { LockedError } from "./workbench/lock";
import {
  appRootsFromExecPath,
  appRootsFromInstallPath,
  defaultInstallDirs,
  stateDirsFor,
} from "./workbench/paths";

const EXTENSION_ID = "otoneko1102.ushiroe";

function findAppRoots(args: string[]): string[] {
  const roots =
    args.length > 0
      ? args.flatMap(appRootsFromInstallPath)
      : [
          ...appRootsFromExecPath(process.execPath),
          ...defaultInstallDirs().flatMap(appRootsFromInstallPath),
        ];
  return [...new Set(roots)];
}

/** Prefers the state folder that actually holds a recorded original checksum. */
function stateDirFor(appRoot: string): string {
  const candidates = stateDirsFor(appRoot, EXTENSION_ID);
  return (
    candidates.find((dir) => fs.existsSync(path.join(dir, "workbench-originals.json"))) ??
    candidates[0]
  );
}

async function main(): Promise<number> {
  const roots = findAppRoots(process.argv.slice(2));
  if (roots.length === 0) {
    console.log("[UshiroE] No VS Code installation found. Pass its install folder as an argument.");
    return 1;
  }
  let failed = false;
  for (const appRoot of roots) {
    const editor = new WorkbenchEditor({ appRoot, stateDir: stateDirFor(appRoot) });
    try {
      const result = await editor.restore();
      console.log(
        result === "backup"
          ? `[UshiroE] Restored ${appRoot} from the saved original.`
          : result === "removed"
            ? `[UshiroE] Removed UshiroE's patch from ${appRoot}.`
            : `[UshiroE] ${appRoot} has no UshiroE changes.`
      );
    } catch (error) {
      failed = true;
      if (error instanceof IntegrityError) {
        console.log(`[UshiroE] ${appRoot}: ${error.message} Reinstalling VS Code restores it.`);
      } else if (error instanceof LockedError) {
        console.log(`[UshiroE] ${appRoot}: ${error.message} Close VS Code and run this again.`);
      } else if (error instanceof PermissionError) {
        console.log(`[UshiroE] ${appRoot}: no permission. Run this again as administrator.`);
      } else {
        console.log(`[UshiroE] ${appRoot}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  return failed ? 1 : 0;
}

void main().then((code) => {
  process.exitCode = code;
});
