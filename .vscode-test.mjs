import { defineConfig } from "@vscode/test-cli";

// Extension tests run with in-memory storage, so they never touch the real
// ~/.vscode-shared that holds the user's GitHub sign-in.
export default defineConfig([
  {
    label: "default",
    files: "out/test/integration/extension.test.js",
    version: "stable",
    launchArgs: ["--disable-extensions"],
    mocha: { ui: "bdd", timeout: 60000 },
  },
  {
    label: "backimage",
    files: "out/test/integration/backimage.test.js",
    version: "stable",
    extensionDevelopmentPath: [".", "test/fixtures/backimage"],
    launchArgs: ["--disable-extensions"],
    mocha: { ui: "bdd", timeout: 60000 },
  },
  {
    // Installed as a normal extension and then disabled: only installed extensions can be
    // turned off with --disable-extension, so this checks what a disabled BackImage looks like.
    label: "backimage-disabled",
    files: "out/test/integration/backimageDisabled.test.js",
    version: "stable",
    installExtensions: ["out/backimage-fixture.vsix"],
    launchArgs: ["--disable-extension", "ROBOTofficial.backimage"],
    mocha: { ui: "bdd", timeout: 60000 },
  },
]);
