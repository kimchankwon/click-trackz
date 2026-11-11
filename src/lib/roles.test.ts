import { describe, expect, it } from "vitest";

import { assignableRoles, canAssignRole, canDeleteGroup, canEditSongs, canManageGroup, canSteerPlayback, outranks, ROLE_NAMES } from "./roles";

describe("roles", () => {
  it("ranks Admin over Group Manager over Song Manager over Playback Manager over Member", () => {
    expect(outranks("admin", "groupManager")).toBe(true);
    expect(outranks("groupManager", "songManager")).toBe(true);
    expect(outranks("songManager", "playbackManager")).toBe(true);
    expect(outranks("playbackManager", "member")).toBe(true);
    expect(outranks("member", "member")).toBe(false);
    expect(outranks("songManager", "groupManager")).toBe(false);
  });

  it("lets Playback Managers and up steer Playback", () => {
    expect(canSteerPlayback("member")).toBe(false);
    expect(canSteerPlayback("playbackManager")).toBe(true);
    expect(canSteerPlayback("songManager")).toBe(true);
    expect(canSteerPlayback("admin")).toBe(true);
  });

  it("lets Song Managers and up edit Songs and Setlists", () => {
    expect(canEditSongs("playbackManager")).toBe(false);
    expect(canEditSongs("songManager")).toBe(true);
    expect(canEditSongs("groupManager")).toBe(true);
  });

  it("lets Group Managers and up manage the Group, and only the Admin delete it", () => {
    expect(canManageGroup("songManager")).toBe(false);
    expect(canManageGroup("groupManager")).toBe(true);
    expect(canManageGroup("admin")).toBe(true);
    expect(canDeleteGroup("groupManager")).toBe(false);
    expect(canDeleteGroup("admin")).toBe(true);
  });

  it("lets the Admin hand out every Role below Admin, and a Group Manager only Song Manager and below", () => {
    expect(assignableRoles("admin")).toEqual(["groupManager", "songManager", "playbackManager", "member"]);
    expect(assignableRoles("groupManager")).toEqual(["songManager", "playbackManager", "member"]);
    expect(assignableRoles("songManager")).toEqual([]);
    expect(assignableRoles("member")).toEqual([]);
  });

  it("only changes the Role of someone ranked below the caller", () => {
    expect(canAssignRole("admin", "groupManager", "member")).toBe(true);
    expect(canAssignRole("groupManager", "songManager", "playbackManager")).toBe(true);
    expect(canAssignRole("groupManager", "groupManager", "member")).toBe(false);
    expect(canAssignRole("groupManager", "member", "groupManager")).toBe(false);
    expect(canAssignRole("admin", "member", "admin")).toBe(false);
  });

  it("names every Role for people", () => {
    expect(ROLE_NAMES).toEqual({
      admin: "Admin",
      groupManager: "Group Manager",
      songManager: "Song Manager",
      playbackManager: "Playback Manager",
      member: "Member",
    });
  });
});
