import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

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
    expect(await rulesHit("src/lib/probe.ts", "/// <reference types=\"expo/types\" />\n// @ts-expect-error\nexport const a: string = 1;\n")).not.toContain("house/no-comments");
  });

  it("wants a reason after an eslint-disable", async () => {
    const bare = "// eslint-disable-next-line @typescript-eslint/no-unused-vars\nconst unused = 1;\n";
    const reasoned = "// eslint-disable-next-line @typescript-eslint/no-unused-vars -- probe\nconst unused = 1;\n";
    expect(await rulesHit("src/lib/probe.ts", bare)).toContain("house/no-comments");
    expect(await rulesHit("src/lib/probe.ts", reasoned)).toEqual([]);
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

