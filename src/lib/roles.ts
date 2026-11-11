export const ROLES_LOW_TO_HIGH = ["member", "playbackManager", "songManager", "groupManager", "admin"] as const;

export type Role = (typeof ROLES_LOW_TO_HIGH)[number];

export const ROLE_NAMES: Record<Role, string> = {
  admin: "Admin",
  groupManager: "Group Manager",
  songManager: "Song Manager",
  playbackManager: "Playback Manager",
  member: "Member",
};

const rankOf = (role: Role) => ROLES_LOW_TO_HIGH.indexOf(role);

export const outranks = (role: Role, other: Role) => rankOf(role) > rankOf(other);

export const atLeast = (role: Role, needed: Role) => rankOf(role) >= rankOf(needed);

export const canSteerPlayback = (role: Role) => atLeast(role, "playbackManager");

export const canEditSongs = (role: Role) => atLeast(role, "songManager");

export const canManageGroup = (role: Role) => atLeast(role, "groupManager");

export const canDeleteGroup = (role: Role) => role === "admin";

const HIGHEST_ASSIGNABLE: Partial<Record<Role, Role>> = { admin: "groupManager", groupManager: "songManager" };

export function assignableRoles(caller: Role): Role[] {
  const highest = HIGHEST_ASSIGNABLE[caller];
  if (highest === undefined) return [];
  return ROLES_LOW_TO_HIGH.filter((role) => atLeast(highest, role)).reverse();
}

export const canAssignRole = (caller: Role, current: Role, next: Role) => outranks(caller, current) && assignableRoles(caller).includes(next);

export const isRole = (value: unknown): value is Role => typeof value === "string" && (ROLES_LOW_TO_HIGH as readonly string[]).includes(value);
