const { SourceSkips } = require("@expo/fingerprint");

module.exports = {
  ignorePaths: ["android", "android/**", "ios", "ios/**"],
  sourceSkips: SourceSkips.PackageJsonScriptsAll | SourceSkips.GitIgnore,
};
