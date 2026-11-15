import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as sudo from "@vscode/sudo-prompt";

export class PermissionError extends Error {
    constructor(public readonly target: string, cause: unknown) {
        super(`No permission to write ${target}`, { cause });
        this.name = "PermissionError";
    }
}

function isPermissionError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return code === "EACCES" || code === "EPERM" || code === "EROFS";
}

/** Writes a file, throwing {@link PermissionError} when elevation would be needed. */
export async function writeFileDirect(target: string, content: string): Promise<void> {
    try {
        await fs.promises.writeFile(target, content, "utf8");
    } catch (error) {
        throw isPermissionError(error) ? new PermissionError(target, error) : error;
    }
}

export async function removeFileDirect(target: string): Promise<void> {
    try {
        await fs.promises.rm(target, { force: true });
    } catch (error) {
        throw isPermissionError(error) ? new PermissionError(target, error) : error;
    }
}

function quote(value: string): string {
    if (value.includes('"')) {
        throw new Error(`Unsupported character in path: ${value}`);
    }
    return `"${value}"`;
}

function sudoExec(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
        sudo.exec(command, { name: "UshiroE" }, (error) => (error ? reject(error) : resolve()));
    });
}

export interface FileChange {
    target: string;
    /** New content, or null to delete the file. */
    content: string | null;
}

/**
 * Applies several file changes with one administrator prompt. Content is staged in the
 * temp folder and copied over the target, which keeps the target's owner and permissions.
 */
export async function applyChangesElevated(changes: FileChange[]): Promise<void> {
    if (changes.length === 0) {
        return;
    }
    const stagingDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ushiroe-"));
    try {
        const commands: string[] = [];
        for (const [index, change] of changes.entries()) {
            if (change.content === null) {
                commands.push(process.platform === "win32" ? `del /F /Q ${quote(change.target)}` : `rm -f ${quote(change.target)}`);
                continue;
            }
            const staged = path.join(stagingDir, `${index}.tmp`);
            await fs.promises.writeFile(staged, change.content, "utf8");
            commands.push(process.platform === "win32"
                ? `copy /Y ${quote(staged)} ${quote(change.target)}`
                : `cp -f ${quote(staged)} ${quote(change.target)}`);
        }
        await sudoExec(commands.join(" && "));
    } finally {
        await fs.promises.rm(stagingDir, { recursive: true, force: true });
    }
}

/** Applies file changes directly, returning the changes that need elevation. */
export async function applyChangesDirect(changes: FileChange[]): Promise<FileChange[]> {
    const denied: FileChange[] = [];
    for (const change of changes) {
        try {
            if (change.content === null) {
                await removeFileDirect(change.target);
            } else {
                await writeFileDirect(change.target, change.content);
            }
        } catch (error) {
            if (!(error instanceof PermissionError)) {
                throw error;
            }
            denied.push(change);
        }
    }
    return denied;
}
