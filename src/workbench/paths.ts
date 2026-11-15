import fs from "node:fs";
import os from "node:os";
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

/**
 * `resources/app` folders under a path the user gives the uninstall hook by hand: the install
 * folder, the executable, or `resources/app` itself.
 */
export function appRootsFromInstallPath(input: string): string[] {
  const resolved = path.resolve(input);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return [];
  }
  if (stat.isFile()) {
    return appRootsFromExecPath(resolved);
  }
  const candidates = [
    resolved,
    path.join(resolved, "resources", "app"),
    path.join(resolved, "Contents", "Resources", "app"),
  ];
  try {
    for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        candidates.push(path.join(resolved, entry.name, "resources", "app"));
      }
    }
  } catch {
    // Unreadable folder: fewer candidates.
  }
  return [...new Set(candidates)].filter((candidate) =>
    fs.existsSync(workbenchPaths(candidate).script)
  );
}

/** Where VS Code is usually installed, for running the uninstall hook without arguments. */
export function defaultInstallDirs(env: NodeJS.ProcessEnv = process.env): string[] {
  switch (process.platform) {
    case "win32":
      return [
        env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Programs", "Microsoft VS Code"),
        env.ProgramFiles && path.join(env.ProgramFiles, "Microsoft VS Code"),
      ].filter((dir): dir is string => Boolean(dir));
    case "darwin":
      return ["/Applications/Visual Studio Code.app"];
    default:
      return ["/usr/share/code", "/opt/visual-studio-code"];
  }
}

/**
 * UshiroE's global storage folders for a VS Code installation, which hold the recorded original
 * checksum and the pristine backup. Follows VS Code's own user data location rules, including
 * `VSCODE_APPDATA` and portable mode.
 */
export function stateDirsFor(
  appRoot: string,
  extensionId: string,
  env: NodeJS.ProcessEnv = process.env,
  home = os.homedir()
): string[] {
  let nameShort = "Code";
  try {
    const product = JSON.parse(fs.readFileSync(workbenchPaths(appRoot).product, "utf8")) as {
      nameShort?: string;
    };
    nameShort = product.nameShort ?? nameShort;
  } catch {
    // Fall back to stable VS Code's folder name.
  }
  const appData =
    env.VSCODE_APPDATA ??
    (process.platform === "win32"
      ? env.APPDATA
      : process.platform === "darwin"
        ? path.join(home, "Library", "Application Support")
        : (env.XDG_CONFIG_HOME ?? path.join(home, ".config")));
  const userDataDirs = [
    env.VSCODE_PORTABLE && path.join(env.VSCODE_PORTABLE, "user-data"),
    path.join(appRoot, "..", "..", "data", "user-data"),
    path.join(appRoot, "..", "..", "..", "data", "user-data"),
    appData && path.join(appData, nameShort),
  ].filter((dir): dir is string => Boolean(dir));
  const names = [...new Set([extensionId.toLowerCase(), extensionId])];
  return userDataDirs.flatMap((dir) =>
    names.map((name) => path.join(path.resolve(dir), "User", "globalStorage", name))
  );
}
