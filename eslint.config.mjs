import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

/**
 * Flat ESLint config (ESLint 9 / Next 16).
 *
 * The generated Prisma client is excluded — it is machine-written and already
 * carries its own @ts-nocheck.
 */
const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "lib/generated/**",
      "next-env.d.ts",
      "coverage/**",
    ],
  },
  ...coreWebVitals,
  ...typescriptConfig,
  {
    rules: {
      // `any` disables exactly the checks this codebase relies on around money
      // and payment state, so it is an error rather than a warning.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      eqeqeq: ["error", "smart"],
      "no-console": ["error", { allow: ["log", "warn", "error"] }],
    },
  },
];

export default config;
