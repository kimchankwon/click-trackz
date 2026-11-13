const DEV_WEB_URL = "https://click-trackz-dev.vercel.app";
const APP_PATHS = ["/join/", "/group/", "/subscribe"];

module.exports = ({ config }) => {
  const host = new URL(process.env.EXPO_PUBLIC_WEB_URL ?? DEV_WEB_URL).host;
  return {
    ...config,
    ios: { ...config.ios, associatedDomains: [`applinks:${host}`] },
    android: {
      ...config.android,
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: APP_PATHS.map((pathPrefix) => ({ scheme: "https", host, pathPrefix })),
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
  };
};
