import { spawnSync } from "node:child_process";

const result = spawnSync("git", ["grep", "--untracked", "-I", "-n", "\u2014", "--", ".", ":!package-lock.json"], { encoding: "utf8" });
if (result.status === 1) process.exit(0);
if (result.status !== 0) {
  console.error(result.stderr);
  process.exit(2);
}
console.error(`${result.stdout}\nEm dash characters found (AGENTS.md bans them everywhere). Use a comma, a colon before a list, or two sentences.`);
process.exit(1);
