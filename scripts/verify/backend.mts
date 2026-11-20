import { execFileSync } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

import { httpOk, requireFreePort, root, run, start, stateDir, waitFor } from "./processes.mts";

export const SEED = {
  email: "admin@example.com",
  groupName: "Verify Band",
  displayName: "Admin",
  songTitle: "Send Me Out",
} as const;

export type Backend = { url: string; siteUrl: string; devSecret: string; groupId: string; songId: string; binary: string };

const INSTANCE_NAME = "click-trackz-verify";
const binariesDir = path.join(os.homedir(), ".cache", "convex", "binaries");
const convexCli = path.join(root, "node_modules", "convex", "bin", "main.js");

function backendBinary(logsDir: string) {
  if (process.env.VERIFY_CONVEX_BACKEND) return process.env.VERIFY_CONVEX_BACKEND;
  const cached = existsSync(binariesDir)
    ? readdirSync(binariesDir)
        .filter((dir) => existsSync(path.join(binariesDir, dir, "convex-local-backend")))
        .sort()
    : [];
  if (cached.length > 0) return path.join(binariesDir, cached[cached.length - 1], "convex-local-backend");
  const target = process.arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
  const dir = path.join(binariesDir, "verify-latest");
  mkdirSync(dir, { recursive: true });
  const zip = path.join(logsDir, "convex-local-backend.zip");
  execFileSync("curl", ["-fsSL", "-o", zip, `https://github.com/get-convex/convex-backend/releases/latest/download/convex-local-backend-${target}.zip`]);
  execFileSync("unzip", ["-o", zip, "-d", dir]);
  return path.join(dir, "convex-local-backend");
}

function authKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const jwk = publicKey.export({ format: "jwk" });
  return { JWT_PRIVATE_KEY: pem.trimEnd().replace(/\n/g, " "), JWKS: JSON.stringify({ keys: [{ use: "sig", alg: "RS256", ...jwk }] }) };
}

const quoted = (value: string) => `'${value.replace(/'/g, "")}'`;

export async function startBackend({ port, webUrl, logsDir }: { port: number; webUrl: string; logsDir: string }): Promise<Backend> {
  const sitePort = port + 1;
  requireFreePort(port, "VERIFY_CONVEX_PORT");
  requireFreePort(sitePort, "VERIFY_CONVEX_PORT");
  const dir = path.join(stateDir, "convex");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const binary = backendBinary(logsDir);
  const instanceSecret = randomBytes(32).toString("hex");
  const adminKey = execFileSync(binary, ["keygen", "admin-key", "--instance-name", INSTANCE_NAME, "--instance-secret", instanceSecret], {
    encoding: "utf8",
  }).trim();
  const url = `http://127.0.0.1:${port}`;
  const siteUrl = `http://127.0.0.1:${sitePort}`;
  start(
    "convex-backend",
    binary,
    [
      "--interface",
      "127.0.0.1",
      "--port",
      String(port),
      "--site-proxy-port",
      String(sitePort),
      "--convex-origin",
      url,
      "--convex-site",
      siteUrl,
      "--instance-name",
      INSTANCE_NAME,
      "--instance-secret",
      instanceSecret,
      "--local-storage",
      path.join(dir, "storage"),
      "--disable-beacon",
      path.join(dir, "db.sqlite3"),
    ],
    { logFile: path.join(logsDir, "convex-backend.log"), cwd: dir },
  );
  await waitFor(`the local Convex backend on ${url}`, httpOk(`${url}/version`), 30_000);

  const selector = path.join(dir, "deployment.env");
  writeFileSync(selector, `CONVEX_SELF_HOSTED_URL=${url}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${adminKey}\n`);
  const cliEnv = { ...process.env, CONVEX_DEPLOYMENT: "", CONVEX_DEPLOY_KEY: "", CONVEX_SELF_HOSTED_URL: url, CONVEX_SELF_HOSTED_ADMIN_KEY: adminKey };
  const cli = async (name: string, args: string[]) => {
    const code = await run(name, process.execPath, [convexCli, ...args], { logFile: path.join(logsDir, `${name}.log`), env: cliEnv, timeoutMs: 180_000 });
    if (code !== 0) throw new Error(`npx convex ${args[0]} exited ${code}; see ${path.join(logsDir, `${name}.log`)}`);
  };

  const devSecret = randomBytes(16).toString("hex");
  const variables = { ...authKeys(), SITE_URL: webUrl, DEV_LOGIN_SECRET: devSecret, DEV_LOGIN_DEPLOYMENT: url };
  const variablesFile = path.join(dir, "variables.env");
  writeFileSync(
    variablesFile,
    Object.entries(variables)
      .map(([name, value]) => `${name}=${quoted(value)}`)
      .join("\n") + "\n",
  );
  await cli("convex-env", ["env", "set", "--from-file", variablesFile, "--force"]);
  await cli("convex-deploy", ["deploy", "--env-file", selector, "--typecheck", "disable", "--codegen", "disable", "-y"]);

  const member = new ConvexHttpClient(url);
  const signedIn = await member.action(anyApi.auth.signIn, { provider: "dev", params: { email: SEED.email, secret: devSecret } });
  member.setAuth(signedIn.tokens.token);
  const { groupId } = await member.mutation(anyApi.groups.createGroup, { name: SEED.groupName, displayName: SEED.displayName });
  await cli("convex-seed", ["run", "seed:firstSetlistForGroup", JSON.stringify({ groupId })]);
  const songs: { songId: string; title: string }[] = await member.query(anyApi.songs.list, { groupId });
  const song = songs.find((entry) => entry.title === SEED.songTitle);
  if (!song) throw new Error(`Seed did not create the Song ${SEED.songTitle}`);
  const bpm = 144;
  await member.mutation(anyApi.songs.updateSong, {
    songId: song.songId,
    bpm,
    sections: [
      { sectionType: "Intro", bars: 4, beatsPerBar: 4, bpm },
      { sectionType: "Verse", number: 1, bars: 8, beatsPerBar: 4, bpm },
      { sectionType: "Chorus", number: 1, bars: 8, beatsPerBar: 4, bpm },
      { sectionType: "Outro", bars: 4, beatsPerBar: 4, bpm },
    ],
  });
  return { url, siteUrl, devSecret, groupId, songId: song.songId, binary };
}
