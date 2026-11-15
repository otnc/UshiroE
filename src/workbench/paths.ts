import fs from "node:fs";
import path from "node:path";

export const WORKBENCH_SCRIPT_KEY = "vs/workbench/workbench.desktop.main.js";

export interface WorkbenchPaths {
  appRoot: string;
  script: string;
  product: string;
  /** Full-file backups that BackImage leaves next to the workbench files. */
  backImageBackups: string[];
}

export function workbenchPaths(appRoot: string): WorkbenchPaths {
  const workbenchDir = path.join(appRoot, "out", "vs", "workbench");
  const script = path.join(appRoot, "out", ...WORKBENCH_SCRIPT_KEY.split("/"));
  return {
    appRoot,
    script,
    product: path.join(appRoot, "product.json"),
    backImageBackups: [
      `${script}.backup`,
      path.join(workbenchDir, "workbench.desktop.main.css.backup"),
      path.join(workbenchDir, "workbench.web.main.css.backup"),
    ],
  };
}

/**
 * Guesses VS Code's `resources/app` folder from the executable path, for the uninstall hook,
 * which runs without the `vscode` API. Covers the classic layout, the versioned Windows
 * layout (`<install>/<commit>/resources/app`) and macOS bundles.
 */
export function appRootsFromExecPath(execPath: string): string[] {
  const exeDir = path.dirname(execPath);
  const candidates = [
    path.join(exeDir, "resources", "app"),
    path.join(exeDir, "..", "Resources", "app"),
  ];
  try {
    for (const entry of fs.readdirSync(exeDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        candidates.push(path.join(exeDir, entry.name, "resources", "app"));
      }
    }
  } catch {
    // An unreadable install folder only means fewer candidates.
  }
  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))].filter((candidate) =>
    fs.existsSync(workbenchPaths(candidate).script)
  );
}
