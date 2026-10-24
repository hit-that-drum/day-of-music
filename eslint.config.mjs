import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // A callback parameter named `t` silently hid the translator from
      // useT() in several components. `_` stays allowed for ignored params.
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": ["error", { allow: ["_"] }],
    },
  },
  {
    // lib/ is the layer components build on; it must not reach back up.
    files: ["src/lib/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/*"],
              message: "lib/ must not depend on components/ — move the shared piece into lib/.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-verify/**",
    "out/**",
    "build/**",
    "mobile/**",
    "next-env.d.ts",
    // Design reference bundle — Babel-in-browser prototype, not production code.
    "design_handoff_day_of_music/**",
    // Claude Code settings and its git worktrees (full checkouts of this repo).
    ".claude/**",
  ]),
]);

export default eslintConfig;
