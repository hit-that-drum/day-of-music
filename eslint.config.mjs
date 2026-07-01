import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
  ]),
]);

export default eslintConfig;
