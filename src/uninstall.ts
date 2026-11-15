/**
 * `vscode:uninstall` hook. VS Code runs it with its own executable in Node mode after the
 * extension is removed, without the `vscode` API, so the install folder is derived from
 * `process.execPath`. Failures are ignored: the user can still reinstall VS Code.
 */
import fs from "node:fs";

import { replaceChecksum, stripUshiroe, vscodeChecksum } from "./workbench/patch";
import { WORKBENCH_SCRIPT_KEY, appRootsFromExecPath, workbenchPaths } from "./workbench/paths";

function cleanInstall(appRoot: string): void {
  const paths = workbenchPaths(appRoot);
  const current = fs.readFileSync(paths.script, "utf8");
  const restored = stripUshiroe(current);
  if (restored === current) {
    return;
  }
  fs.writeFileSync(paths.script, restored, "utf8");
  const product = fs.readFileSync(paths.product, "utf8");
  const updated = replaceChecksum(product, WORKBENCH_SCRIPT_KEY, vscodeChecksum(restored));
  if (updated !== null && updated !== product) {
    fs.writeFileSync(paths.product, updated, "utf8");
  }
}

for (const appRoot of appRootsFromExecPath(process.execPath)) {
  try {
    cleanInstall(appRoot);
  } catch (error) {
    console.error(`[UshiroE] Could not clean ${appRoot}:`, error);
  }
}
