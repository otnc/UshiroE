import { defineConfig } from "vitest/config";

// test/integration runs inside VS Code through `npm run test:integration`, not under Vitest.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/integration/**", "node_modules/**"],
  },
});
