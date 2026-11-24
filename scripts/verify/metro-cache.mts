import { createHash } from "node:crypto";
import path from "node:path";

export function metroTmpDir(stateDir: string, appVars: Record<string, string>) {
  const named = Object.keys(appVars)
    .sort()
    .map((name) => [name, appVars[name]]);
  const key = createHash("sha256").update(JSON.stringify(named)).digest("hex").slice(0, 16);
  return path.join(stateDir, "metro", key);
}
