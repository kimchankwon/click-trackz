const DEV_SITE_URL = "https://cue-tracker-six-dev.vercel.app";

export const siteUrl = (): string => process.env.EXPO_PUBLIC_WEB_URL ?? DEV_SITE_URL;
