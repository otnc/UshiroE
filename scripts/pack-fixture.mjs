// Packs the BackImage test double into out/backimage-fixture.vsix, so the integration tests can
// install it as a normal extension. Only installed extensions can be turned off with
// --disable-extension; one loaded through --extensionDevelopmentPath always runs.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "out", "backimage-fixture.vsix");
fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync(
  process.execPath,
  [
    path.join(root, "node_modules", "@vscode", "vsce", "vsce"),
    "package",
    "--allow-missing-repository",
    "--skip-license",
    "--no-dependencies",
    "--out",
    out,
  ],
  { cwd: path.join(root, "test", "fixtures", "backimage"), stdio: "inherit" }
);
