import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import { fixupPluginRules } from "@eslint/compat";
import importPlugin from "eslint-plugin-import";
import noInstanceof from "eslint-plugin-no-instanceof";

export default defineConfig([
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    plugins: {
      "@typescript-eslint": typescriptEslint,
      import: fixupPluginRules(importPlugin),
      "no-instanceof": noInstanceof,
    },

    rules: {
      // Core rules
      "no-process-env": "error",
      "no-instanceof/no-instanceof": "error",
      "keyword-spacing": "error",
      "new-cap": ["error", { properties: false, capIsNew: false }],

      // TypeScript
       ...typescriptEslint.configs.recommended.rules,
      "@typescript-eslint/explicit-module-boundary-types": "warn",
      "@typescript-eslint/no-use-before-define": ["error", "nofunc"],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: 'type-imports', // Enforces using 'import type'
          disallowTypeAnnotations: true, // Disallows type annotations in regular imports
          fixStyle: 'separate-type-imports', // Groups type imports into a separate 'import type' statement
        },
      ],

      // Import plugin
      "import/no-extraneous-dependencies": [
        "error",
        { devDependencies: ["**/*.test.ts"] },
      ],
      "import/no-unresolved": "off",
      "import/prefer-default-export": "off",

      // Disabled legacy rules (kept for clarity)
      camelcase: "off",
      "class-methods-use-this": "off",
      "consistent-return": "off",
      "no-console": "off",
      "no-use-before-define": "off",
    },
  },
  globalIgnores([
    "**/node_modules",
    "**/dist",
    "**/*.js",
    "**/*.cjs",
    "**/*.d.ts",
  ]),
]);
