import { describe, expect, it } from "vitest";

import { parseHandoff } from "./parse-handoff";

describe("parseHandoff", () => {
  it("reads back a saved handoff", () => {
    expect(parseHandoff(JSON.stringify({ token: "abc" }))).toEqual({ token: "abc" });
  });

  it("ignores nothing, broken JSON and other shapes", () => {
    expect(parseHandoff(null)).toBeNull();
    expect(parseHandoff("{")).toBeNull();
    expect(parseHandoff(JSON.stringify({ token: 3 }))).toBeNull();
  });
});
