import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next's core-web-vitals bundles jsx-a11y but only turns on
  // 6 of its ~34 rules (D1 audit finding: "the real gap — no automated a11y
  // linting"). The full recommended rule set below supersedes that minimal
  // subset — only `.rules` is spread (not `.plugins`), since nextVitals
  // already registers the jsx-a11y plugin instance and flat-config errors
  // on two configs registering the same plugin name twice. Scoped to
  // app/**+components/** — jsx-a11y is meaningless outside JSX, and this
  // repo also lints plain .ts/.mjs config/script files.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
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
