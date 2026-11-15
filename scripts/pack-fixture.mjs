// Package the BackImage fixture so integration tests can install and disable it.
// `--disable-extension` does not affect extensions loaded with `--extensionDevelopmentPath`.
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
