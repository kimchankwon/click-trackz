const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("flac");

if (process.env.EXPO_NO_DOTENV) {
  config.resolver.blockList = [...[config.resolver.blockList].flat(), /(^|[\\/])\.env(\.[\w.]+)?$/];
}

module.exports = config;
