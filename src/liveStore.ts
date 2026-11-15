import fs from "node:fs";
import path from "node:path";

import type { LiveConfig } from "./core/live";
import { toWorkbenchUrl } from "./core/resolve";

/**
 * Stores the live config in the extension's global storage folder. VS Code's `vscode-file:`
 * protocol serves the default profile's global storage folder, so the workbench can fetch it.
 */
export class LiveStore {
    readonly file: string;
    private lastWritten: string | undefined;

    constructor(storageDir: string) {
        this.file = path.join(storageDir, "live.json");
    }

    get url(): string {
        return toWorkbenchUrl(this.file);
    }

    /** Writes atomically so a polling window never reads half a file. */
    async write(config: LiveConfig): Promise<void> {
        const text = JSON.stringify(config);
        if (text === this.lastWritten) {
            return;
        }
        await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
        const temp = `${this.file}.${process.pid}.tmp`;
        await fs.promises.writeFile(temp, text, "utf8");
        try {
            await fs.promises.rename(temp, this.file);
        } catch {
            // Windows refuses the rename while another process has the file open; overwrite instead.
            await fs.promises.writeFile(this.file, text, "utf8");
            await fs.promises.rm(temp, { force: true });
        }
        this.lastWritten = text;
    }
}
