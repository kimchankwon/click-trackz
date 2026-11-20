import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { ESLint } from "eslint";
import { afterAll, describe, expect, it } from "vitest";

const ignoredProbe = `${__dirname}/../design-shots/lint-probe.ts`;
mkdirSync(`${__dirname}/../design-shots`, { recursive: true });
writeFileSync(ignoredProbe, "// generated\n");
afterAll(() => rmSync(ignoredProbe, { force: true }));

const eslint = new ESLint({
  cwd: `${__dirname}/..`,
  overrideConfig: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      languageOptions: { parserOptions: { projectService: false } },
      rules: {
        "@typescript-eslint/no-floating-promises": "off",
        "@typescript-eslint/no-misused-promises": "off",
        "@typescript-eslint/await-thenable": "off",
      },
    },
  ],
});

async function rulesHit(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((message) => message.ruleId);
}

describe("house/no-comments", () => {
  it("flags comments and allows pragmas", async () => {
    expect(await rulesHit("src/lib/probe.ts", "export const a = 1;\n// explains a\n")).toContain("house/no-comments");
    expect(await rulesHit("src/lib/probe.ts", "export const a = 1;\n// eslint is slow, so this is cached\n")).toContain("house/no-comments");
    expect(await rulesHit("src/lib/probe.ts", "/// <reference types=\"expo/types\" />\n// @ts-expect-error\nexport const a: string = 1;\n")).not.toContain("house/no-comments");
  });

  it("wants a reason after an eslint-disable", async () => {
    const bare = "// eslint-disable-next-line @typescript-eslint/no-unused-vars\nconst unused = 1;\n";
    const reasoned = "// eslint-disable-next-line @typescript-eslint/no-unused-vars -- probe\nconst unused = 1;\n";
    expect(await rulesHit("src/lib/probe.ts", bare)).toContain("house/no-comments");
    expect(await rulesHit("src/lib/probe.ts", reasoned)).toEqual([]);
  });
});

describe("house/glossary-terms", () => {
  it("flags avoided words people read, not ids", async () => {
    expect(await rulesHit("src/components/probe.tsx", "export const A = () => <Text>Invite the band</Text>;\n")).toContain("house/glossary-terms");
    expect(await rulesHit("src/components/probe.tsx", "export const A = () => <Text>{\"Invite the band\"}</Text>;\n")).toContain("house/glossary-terms");
    expect(await rulesHit("src/components/probe.tsx", "export const A = () => <Text accessibilityLabel={`Remove user ${1}`} />;\n")).toContain("house/glossary-terms");
    expect(await rulesHit("src/components/probe.tsx", "export const A = () => <Text testID=\"user-row\">Members</Text>;\n")).not.toContain("house/glossary-terms");
    expect(await rulesHit("convex/probe.ts", "import { ConvexError } from \"convex/values\";\nexport const f = () => { throw new ConvexError(\"Only musicians can join\"); };\n")).toContain("house/glossary-terms");
  });
});

describe("client clock reads", () => {
  it("sends bare reads in app code to the server clock or the device clock helpers", async () => {
    expect(await rulesHit("src/components/probe.tsx", "export const at = Date.now();\n")).toContain("no-restricted-properties");
    expect(await rulesHit("src/audio/probe.ts", "export const at = performance.now();\n")).toContain("no-restricted-properties");
    expect(await rulesHit("src/sync/probe.ts", "export const at = performance.now();\n")).toEqual([]);
    expect(await rulesHit("convex/probe.ts", "export const at = Date.now();\n")).toEqual([]);
  });
});

describe("route files", () => {
  it("holds only the screen", async () => {
    const extra = "function Extra() { return null; }\nexport default function Screen() { return <Extra />; }\n";
    expect(await rulesHit("src/app/probe.tsx", extra)).toContain("no-restricted-syntax");
    const arrow = "const Extra = () => null;\nexport default function Screen() { return <Extra />; }\n";
    expect(await rulesHit("src/app/probe.tsx", arrow)).toContain("no-restricted-syntax");
    expect(await rulesHit("src/app/probe.tsx", "export default function Screen() { return null; }\n")).toEqual([]);
  });
});

describe("gitignored files", () => {
  it("are not linted, so generated files like expo-env.d.ts never fail lint", async () => {
    expect(await eslint.isPathIgnored("design-shots/lint-probe.ts")).toBe(true);
    expect(await eslint.isPathIgnored("src/lib/device-clock.ts")).toBe(false);
  });
});
