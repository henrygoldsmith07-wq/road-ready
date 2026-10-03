import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{js,mjs}"],
    environment: "node",
    // Some tests spawn a child node process (content CLI, hygiene guard).
    // On slow machines node startup alone can exceed vitest's 5s default,
    // which turns device overhead into fake test failures. The assertions
    // themselves are unchanged.
    testTimeout: 60_000,
  },
});
