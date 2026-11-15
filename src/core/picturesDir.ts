import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Reads `XDG_PICTURES_DIR` from `~/.config/user-dirs.dirs`. */
export function parseXdgPictures(contents: string, home: string): string | null {
  const match = /^\s*XDG_PICTURES_DIR\s*=\s*"([^"]*)"/m.exec(contents);
  if (!match) {
    return null;
  }
  const value = match[1].replace(/^\$HOME(?=\/|$)/, home);
  // A value equal to $HOME means the directory is disabled.
  return path.isAbsolute(value) && path.resolve(value) !== path.resolve(home) ? value : null;
}

/**
 * Asks Windows for the Pictures folder, which follows redirections such as OneDrive. The
 * output is forced to UTF-8, because console output in the OEM code page would garble
 * non-ASCII folder names such as Japanese user names.
 */
function windowsPictures(): string | null {
  try {
    const output = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "[Console]::OutputEncoding=[Text.Encoding]::UTF8;[Environment]::GetFolderPath('MyPictures')",
      ],
      { encoding: "utf8", windowsHide: true, timeout: 10_000 }
    ).trim();
    return path.isAbsolute(output) ? output : null;
  } catch {
    return null;
  }
}

function linuxPictures(home: string): string | null {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  try {
    return parseXdgPictures(fs.readFileSync(path.join(configHome, "user-dirs.dirs"), "utf8"), home);
  } catch {
    return null;
  }
}

/** The OS's standard pictures folder, falling back to `~/Pictures`. */
export function picturesDir(): string {
  const home = os.homedir();
  const detected =
    process.platform === "win32"
      ? windowsPictures()
      : process.platform === "linux"
        ? linuxPictures(home)
        : null;
  return detected ?? path.join(home, "Pictures");
}
