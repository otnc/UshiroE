import fs from "node:fs/promises";
import path from "node:path";

import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");
const outdir = "dist";

/** @type {esbuild.BuildOptions} */
const common = {
    bundle: true,
    logLevel: "info",
    sourcemap: production ? false : "linked",
    minify: production,
    legalComments: "none",
};

/** @type {esbuild.BuildOptions[]} */
const builds = [
    {
        ...common,
        entryPoints: { extension: "src/extension.ts", uninstall: "src/uninstall.ts" },
        outdir,
        platform: "node",
        format: "cjs",
        target: "node20",
        external: ["vscode"],
    },
    {
        // Injected into VS Code's workbench script: always minified and without source maps.
        ...common,
        entryPoints: { runtime: "src/runtime/main.ts" },
        outdir,
        platform: "browser",
        format: "iife",
        globalName: "__ushiroeRuntime",
        target: "chrome120",
        minify: true,
        sourcemap: false,
    },
    {
        ...common,
        entryPoints: { panel: "src/webview/panel.ts" },
        outdir,
        platform: "browser",
        format: "iife",
        target: "chrome120",
    },
];

const copies = [
    ["media/panel.css", "panel.css"],
    ["node_modules/@vscode/codicons/dist/codicon.css", "codicons/codicon.css"],
    ["node_modules/@vscode/codicons/dist/codicon.ttf", "codicons/codicon.ttf"],
    ["node_modules/sql.js/dist/sql-wasm.wasm", "sql-wasm.wasm"],
];

async function copyAssets() {
    for (const [from, to] of copies) {
        const target = path.join(outdir, to);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile(from, target);
    }
}

await fs.rm(outdir, { recursive: true, force: true });
await copyAssets();
if (watch) {
    for (const options of builds) {
        const context = await esbuild.context(options);
        await context.watch();
    }
} else {
    await Promise.all(builds.map((options) => esbuild.build(options)));
}
