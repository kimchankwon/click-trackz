const { DEFAULT_SOURCE_SKIPS, SourceSkips } = require("@expo/fingerprint");

module.exports = {
  ignorePaths: ["android", "android/**", "ios", "ios/**"],
  sourceSkips: DEFAULT_SOURCE_SKIPS | SourceSkips.PackageJsonScriptsAll | SourceSkips.GitIgnore,
};
