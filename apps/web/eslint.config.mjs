import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import baseConfig from "../../eslint.config.mjs";

export default defineConfig([
  ...baseConfig,
  { ignores: ["dist"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Root config targets the Node agent; relax backend-only rules for browser code
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-undef": "off",
      "no-process-env": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { 
          checksVoidReturn: { attributes: false },
          
        },
      ],
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  }
]);
