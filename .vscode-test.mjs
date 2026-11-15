import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "out/test/integration/**/*.test.js",
  version: "stable",
  launchArgs: ["--disable-extensions"],
  mocha: { ui: "bdd", timeout: 60000 },
});
