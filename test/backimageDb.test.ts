import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import initSqlJs from "sql.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findStateDatabases, readBackImageState } from "../src/migration/backimage";

const WASM = path.resolve("node_modules/sql.js/dist/sql-wasm.wasm");

describe("BackImage state database", () => {
    let userDir: string;
    const state = { imageLists: [{ id: "1", type: "file", path: "/a.png", name: "a", description: "" }], enable: true };

    async function createDb(file: string, key: string, value: string | null): Promise<void> {
        const SQL = await initSqlJs({ locateFile: () => WASM });
        const db = new SQL.Database();
        db.run("CREATE TABLE ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB)");
        db.run("INSERT INTO ItemTable VALUES ('other.extension', '{}')");
        if (value !== null) {
            db.run("INSERT INTO ItemTable VALUES (?, ?)", [key, value]);
        }
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, db.export());
        db.close();
    }

    beforeAll(async () => {
        userDir = fs.mkdtempSync(path.join(os.tmpdir(), "ushiroe-db-"));
        await createDb(path.join(userDir, "globalStorage", "state.vscdb"), "ROBOTofficial.backimage", JSON.stringify(state));
        await createDb(path.join(userDir, "profiles", "abc", "globalStorage", "state.vscdb"), "robotofficial.backimage", null);
    });

    afterAll(() => fs.rmSync(userDir, { recursive: true, force: true }));

    it("finds the default and profile databases", () => {
        const found = findStateDatabases(path.join(userDir, "globalStorage"));
        expect(found.map((entry) => entry.label)).toEqual(["default", "abc"]);
    });

    it("reads BackImage's JSON regardless of the key's case", async () => {
        const [defaultDb, profileDb] = findStateDatabases(path.join(userDir, "globalStorage"));
        expect(await readBackImageState(defaultDb.file, WASM)).toEqual(state);
        expect(await readBackImageState(profileDb.file, WASM)).toBeNull();
    });
});
