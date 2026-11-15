import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/out/**",
      "**/dist/**",
      "*.vsix",
      "**/.vscode-test/**",
      ".agents/**",
      "test/fixtures/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/runtime/**/*.ts", "src/webview/**/*.ts"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["**/*.mjs", ".kiritanconfig"],
    languageOptions: { sourceType: "module", globals: { ...globals.node } },
  }
);
