/**
 * `vscode:uninstall` hook. VS Code runs it with its own executable in Node mode after the
 * extension is removed, without the `vscode` API, so the install folder is derived from
 * `process.execPath`. Failures are ignored: the user can still reinstall VS Code.
 */
import fs from "node:fs";

import { appRootsFromExecPath, workbenchPaths } from "./workbench/paths";
import { planRemove } from "./workbench/plan";

function cleanInstall(appRoot: string): void {
  const paths = workbenchPaths(appRoot);
  const script = fs.readFileSync(paths.script, "utf8");
  const product = fs.existsSync(paths.product) ? fs.readFileSync(paths.product, "utf8") : null;
  const edit = planRemove({ script, product });
  if (edit.script === undefined) {
    return;
  }
  fs.writeFileSync(paths.script, edit.script, "utf8");
  if (edit.product !== undefined) {
    fs.writeFileSync(paths.product, edit.product, "utf8");
  }
}

for (const appRoot of appRootsFromExecPath(process.execPath)) {
  try {
    cleanInstall(appRoot);
  } catch (error) {
    console.error(`[UshiroE] Could not clean ${appRoot}:`, error);
  }
}
