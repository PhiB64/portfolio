import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  // `.wrangler` est l'état local des Workers : du code généré, versionné par
  // Wrangler et pas par nous. Il est ignoré par git, il doit l'être aussi par
  // ESLint, sinon `npm run lint` échoue sur des fichiers éphémères.
  globalIgnores(["dist", ".next", "node_modules", "**/.wrangler/**"]),
  {
    // Tests Vitest : le runner fournit ses propres globals (`describe`, `it`,
    // `expect`), et `process` est ambiant côté Node comme côté navigateur.
    files: ["**/*.test.{js,jsx}", "vitest.config.js"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      react.configs.flat.recommended,
      reactHooks.configs["recommended-latest"],
    ],
    rules: {
      "react/jsx-uses-vars": "error",
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
]);