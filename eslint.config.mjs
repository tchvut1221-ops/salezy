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
    "out/**",
    "build/**",
    "next-env.d.ts",
    // `**/` prefix so these also match inside a nested checkout, e.g. a git
    // worktree under .worktrees/<branch>/.next — without it, a stale build
    // cache left in a worktree gets linted as source and floods `npm run
    // lint` with thousands of errors from generated code (hit in practice).
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    // Worktrees are full nested checkouts of this repo — never lint them
    // from the primary checkout; each worktree lints itself independently.
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
