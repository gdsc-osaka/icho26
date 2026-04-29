import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "build/**",
      ".react-router/**",
      ".wrangler/**",
      "node_modules/**",
      "worker-configuration.d.ts",
      "db/migrations/**",
      "pnpm-lock.yaml",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Allow underscore-prefixed identifiers as a deliberate "unused" marker.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.{tsx,jsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "react/prop-types": "off",
    },
  },
  // Test files: relax `no-unused-expressions` for vitest's expect chains and
  // allow `any` in fixtures.
  {
    files: ["tests/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // React Router v7 framework mode requires every route file to export
  // `loader`, `action`, `meta`, and a default component side-by-side. This
  // pattern is incompatible with `react-refresh/only-export-components`
  // (the rule assumes one component per file) so we disable it here.
  {
    files: ["app/routes/**/*.{ts,tsx}", "app/root.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  // Disable rules that fight Prettier's formatting.
  prettier,
];
