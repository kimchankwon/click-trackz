import { describe, expect, it } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";
import { parseStoredHome, type StoredHome } from "./stored-home";

const home: StoredHome = {
  format: 1,
  isAnonymous: false,
  groups: [
    {
      groupId: "g1" as Id<"groups">,
      name: "Sunday band",
      role: "admin",
      offline: false,
      copyBase: null,
      locked: false,
      guest: false,
      owned: true,
      joinCode: "ABCDEF",
      joinRole: "member",
    },
  ],
};

describe("parseStoredHome", () => {
  it("reads back what was saved", () => {
    expect(parseStoredHome(JSON.stringify(home))).toEqual(home);
  });

  it("is empty when nothing was saved", () => {
    expect(parseStoredHome(null)).toBeNull();
  });

  it("drops a copy that is not JSON", () => {
    expect(parseStoredHome("{")).toBeNull();
  });

  it("drops a copy from another format", () => {
    expect(parseStoredHome(JSON.stringify({ ...home, format: 2 }))).toBeNull();
  });

  it("drops a copy with a malformed Group", () => {
    expect(parseStoredHome(JSON.stringify({ ...home, groups: [{ groupId: "g1", name: "Sunday band" }] }))).toBeNull();
  });

  it("drops a copy without the account kind", () => {
    const { isAnonymous: _unused, ...rest } = home;
    expect(parseStoredHome(JSON.stringify(rest))).toBeNull();
  });
});
