const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");

const typedFiles = ["**/*.ts", "**/*.tsx", "scripts/**/*.mts"];

module.exports = defineConfig([
  expoConfig,
  {
    files: ["scripts/**/*.mts"],
    plugins: { "@typescript-eslint": tsPlugin },
    languageOptions: { parser: tsParser },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
  {
    files: typedFiles,
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: __dirname } },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unused-vars": ["error", { args: "after-used", argsIgnorePattern: "^_", ignoreRestSiblings: true, caughtErrors: "all" }],
      "import/no-duplicates": "error",
    },
  },
  {
    files: ["src/audio/builtin-voice-clips.ts"],
    rules: { "@typescript-eslint/no-require-imports": ["error", { allow: ["\\.flac$"] }] },
  },
  {
    files: ["*.config.js", "lint/**/*.js"],
    languageOptions: { globals: { __dirname: "readonly", require: "readonly", module: "writable", process: "readonly" } },
  },
  {
    ignores: ["dist/**", "convex/_generated/**", ".expo/**"],
  },
]);
