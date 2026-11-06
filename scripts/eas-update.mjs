import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [profile, ...extraArgs] = process.argv.slice(2);
const build = JSON.parse(readFileSync("eas.json", "utf8")).build?.[profile];
if (!build?.channel || !build.environment) {
  console.error(`Usage: node scripts/eas-update.mjs <production|preview> [eas update options]. eas.json needs a channel and an environment for "${profile ?? ""}".`);
  process.exit(1);
}

const [command, ...commandArgs] = (process.env.EAS_CLI ?? "npx --yes eas-cli@latest").split(" ");
execFileSync(command, [...commandArgs, "update", "--channel", build.channel, "--environment", build.environment, "--auto", ...extraArgs], {
  stdio: "inherit",
  env: { ...process.env, EXPO_NO_DOTENV: "1", ...build.env },
});
