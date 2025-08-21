import js from "@eslint/js";
import path from "node:path";
import tseslint from "typescript-eslint";
import checkFile from "eslint-plugin-check-file";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Server ESLint config
  {
    files: ["apps/server/**/*.ts", "apps/server/**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        tsconfigRootDir: new URL(".", import.meta.url),
        project: ["./tsconfig.json"],
      },
    },
    plugins: {
      "check-file": checkFile,
    },
    rules: {
      camelcase: ["error"],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-empty-function": "warn",

      "check-file/folder-naming-convention": ["error", { "./apps/server/**/*": "CAMEL_CASE" }],
      "check-file/filename-naming-convention": [
        "error",
        { "./apps/server/**/*": "CAMEL_CASE" },
        { ignoreMiddleExtensions: true },
      ],

      "no-console": "warn",
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-unused-expressions": "error",
      "prefer-const": "error",
      "no-var": "error",

      eqeqeq: ["error", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-return-assign": "error",
      "no-self-compare": "error",
      "no-sequences": "error",
      "no-throw-literal": "error",
      "no-unmodified-loop-condition": "error",
      "no-unused-labels": "error",
      "no-useless-call": "error",
      "no-useless-concat": "error",
      "no-useless-return": "error",
      "prefer-promise-reject-errors": "error",

      "array-bracket-spacing": ["error", "never"],
      "comma-dangle": ["error", "always-multiline"],
      "comma-spacing": ["error", { before: false, after: true }],
      "key-spacing": ["error", { beforeColon: false, afterColon: true }],
      "no-trailing-spaces": "error",
      "object-curly-spacing": ["error", "always"],
      "quote-props": ["error", "as-needed"],
      "space-before-blocks": "error",
      "space-in-parens": ["error", "never"],
    },
  },
  // Client ESLint config
  {
    files: ["apps/client/**/*.ts", "apps/client/**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        tsconfigRootDir: new URL(".", import.meta.url),
        project: ["./apps/client/tsconfig.json"],
      },
    },
    plugins: {
      "check-file": checkFile,
    },
    rules: {
      camelcase: ["error"],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-empty-function": "warn",

      "check-file/folder-naming-convention": ["error", { "./apps/client/**/*": "CAMEL_CASE" }],
      "check-file/filename-naming-convention": [
        "error",
        { "./apps/client/**/*": "CAMEL_CASE" },
        { ignoreMiddleExtensions: true },
      ],

      "no-console": "warn",
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-unused-expressions": "error",
      "prefer-const": "error",
      "no-var": "error",

      eqeqeq: ["error", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-return-assign": "error",
      "no-self-compare": "error",
      "no-sequences": "error",
      "no-throw-literal": "error",
      "no-unmodified-loop-condition": "error",
      "no-unused-labels": "error",
      "no-useless-call": "error",
      "no-useless-concat": "error",
      "no-useless-return": "error",
      "prefer-promise-reject-errors": "error",

      "array-bracket-spacing": ["error", "never"],
      "comma-dangle": ["error", "always-multiline"],
      "comma-spacing": ["error", { before: false, after: true }],
      "key-spacing": ["error", { beforeColon: false, afterColon: true }],
      "no-trailing-spaces": "error",
      "object-curly-spacing": ["error", "always"],
      "quote-props": ["error", "as-needed"],
      "space-before-blocks": "error",
      "space-in-parens": ["error", "never"],
    },
  },

  // Type declaration files
  {
    files: ["**/*.d.ts"],
    rules: {
      "check-file/filename-naming-convention": "off",
    },
  },

  // Disable console rule for main server entry
  {
    files: ["apps/server/src/server.ts"],
    rules: {
      "no-console": "off",
    },
  },

  // JS-only settings
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2020,
    },
  },

  // Ignore certain folders
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "*.config.js",
      "coverage/**",
      "apps/client/node_modules/**",
    ],
  },
];
