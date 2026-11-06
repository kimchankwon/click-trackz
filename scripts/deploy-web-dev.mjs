import { execSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const DEV_CONVEX_URL = "https://groovy-grouse-274.ap-southeast-2.convex.cloud";
const VERCEL_ORG_ID = "team_BN2cAhJhnaYsx0CBERDsYOeF";
const VERCEL_PROJECT_ID = "prj_uQ76oMCYa2m6BgtyTTv3eZtJuK37";
const EXPORT = "npx expo export --platform web -c";

const run = (command, env = {}) => execSync(command, { stdio: "inherit", env: { ...process.env, ...env } });

const deployKey = process.env.CONVEX_DEPLOY_KEY_DEV;
if (deployKey && !deployKey.startsWith("dev:")) {
  throw new Error("CONVEX_DEPLOY_KEY_DEV must be a development deploy key (it starts with dev:).");
}

rmSync("dist", { recursive: true, force: true });
const buildEnv = { EXPO_PUBLIC_DEV_LOGIN: "1" };
if (deployKey) {
  run(`npx convex deploy --cmd '${EXPORT}' --cmd-url-env-var-name EXPO_PUBLIC_CONVEX_URL`, { ...buildEnv, CONVEX_DEPLOY_KEY: deployKey });
} else {
  console.warn("CONVEX_DEPLOY_KEY_DEV is not set, so only the web app is built and the dev backend is left as it is.");
  run(EXPORT, { ...buildEnv, EXPO_PUBLIC_CONVEX_URL: DEV_CONVEX_URL });
}

writeFileSync("dist/.vercelignore", "!/assets/node_modules\n!/assets/node_modules/**\n");
writeFileSync(
  "dist/vercel.json",
  `${JSON.stringify({ framework: null, rewrites: [{ source: "/((?!_expo/|assets/).*)", destination: "/index.html" }] }, null, 2)}\n`,
);
run("npx vercel@65.11.0 deploy dist --prod --yes", { VERCEL_ORG_ID, VERCEL_PROJECT_ID });
