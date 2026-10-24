// vitest.config.mts — unit tests (npm test).
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve "@/*" from tsconfig.json itself, so the alias is defined once.
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Pure lib/ functions only so far — no DOM. A file that needs one can opt
    // in with a `// @vitest-environment jsdom` comment (plus the jsdom package).
    environment: "node",
  },
});
