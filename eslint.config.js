const { execFileSync } = require("node:child_process");
const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const house = require("./lint/house-rules");

const typedFiles = ["**/*.ts", "**/*.tsx", "scripts/**/*.mts"];
const testFiles = ["**/*.test.ts", "**/*.test.tsx"];

const routeFilesWithExtraComponents = [
  "src/app/index.tsx",
  "src/app/group/[[]groupId]/index.tsx",
  "src/app/group/[[]groupId]/song/[[]songId].tsx",
  "src/app/group/[[]groupId]/setlist/[[]setlistId].tsx",
];

const gitIgnored = () => {
  try {
    return execFileSync("git", ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory"], { cwd: __dirname, encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .map((entry) => (entry.endsWith("/") ? `${entry}**` : entry));
  } catch {
    return [];
  }
};

const clockMessage =
  "Beat timing comes from the Convex server clock (AGENTS.md). Use serverNow or useServerNow for anything compared with server time; for device-local timing call wallClockNow or monotonicNow from @/lib/device-clock.";

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
    plugins: { house },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "house/no-comments": "error",
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
    files: ["src/**/*.tsx", "convex/**/*.ts"],
    ignores: [...testFiles, "src/components/about/**"],
    rules: { "house/glossary-terms": "error" },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: [...testFiles, "src/sync/**", "src/lib/device-clock.ts", "src/lib/use-server-now.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now", message: clockMessage },
        { object: "performance", property: "now", message: clockMessage },
      ],
    },
  },
  {
    files: ["src/app/**/*.ts", "src/app/**/*.tsx"],
    ignores: routeFilesWithExtraComponents,
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: [
            "Program > FunctionDeclaration[id.name=/^[A-Z]/]",
            "Program > ExportNamedDeclaration > FunctionDeclaration[id.name=/^[A-Z]/][id.name!='ErrorBoundary']",
            "Program > VariableDeclaration > VariableDeclarator[id.name=/^[A-Z]/][init.type=/^(ArrowFunctionExpression|FunctionExpression)$/]",
            "Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name=/^[A-Z]/][init.type=/^(ArrowFunctionExpression|FunctionExpression)$/]",
          ].join(", "),
          message: "A route file holds only its screen (AGENTS.md). Move this component to src/components.",
        },
      ],
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
  globalIgnores(["dist/**", "convex/_generated/**", ".expo/**", ...gitIgnored()]),
]);
