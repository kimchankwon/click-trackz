const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    files: ["src/audio/builtin-voice-clips.ts"],
    rules: { "@typescript-eslint/no-require-imports": ["warn", { allow: ["\\.flac$"] }] },
  },
  {
    ignores:["dist/**", "convex/_generated/**", ".expo/**"],
  },
]);
