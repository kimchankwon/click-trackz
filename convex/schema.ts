import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { soundFields } from "./sound";

export const sectionFields = v.object({
  sectionType: v.string(),
  number: v.optional(v.number()),
  letter: v.optional(v.union(v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D"), v.literal("E"))),
  bars: v.number(),
  beatsPerBar: v.number(),
  beatUnit: v.optional(v.number()),
  bpm: v.number(),
  voiceCueEnabled: v.optional(v.boolean()),
  customLabel: v.optional(v.string()),
  ownTempo: v.optional(v.boolean()),
  plays: v.optional(v.number()),
  timeChanges: v.optional(v.array(v.object({ bar: v.number(), bars: v.number(), beatsPerBar: v.number(), beatUnit: v.number() }))),
});

export const roleValidator = v.union(
  v.literal("admin"),
  v.literal("groupManager"),
  v.literal("songManager"),
  v.literal("playbackManager"),
  v.literal("member"),
);

export const joinRoleValidator = v.union(v.literal("member"), v.literal("playbackManager"), v.literal("songManager"));

export const activityKindValidator = v.union(v.literal("playback"), v.literal("song"), v.literal("setlist"), v.literal("group"), v.literal("comment"));

export const chatKindValidator = v.union(v.literal("comment"), v.literal("reaction"));

export const paidPlanValidator = v.union(v.literal("plus"), v.literal("pro"));

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    accent: v.optional(v.string()),
    sound: v.optional(soundFields),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
  groups: defineTable({
    name: v.string(),
    joinCode: v.string(),
    createdBy: v.id("users"),
    currentSetlistId: v.optional(v.id("setlists")),
    offline: v.optional(v.boolean()),
    copyBase: v.optional(v.string()),
    libraryRevision: v.optional(v.number()),
    joinRole: v.optional(joinRoleValidator),
  })
    .index("by_join_code", ["joinCode"])
    .index("by_created_by", ["createdBy"]),
  memberships: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: roleValidator,
    displayName: v.string(),
    lastSeenAt: v.optional(v.number()),
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_user", ["groupId", "userId"])
    .index("by_role_seen", ["role", "lastSeenAt"]),
  songs: defineTable({
    groupId: v.id("groups"),
    title: v.string(),
    key: v.optional(v.string()),
    tempoHint: v.optional(v.object({ bpm: v.number(), beatsPerBar: v.number() })),
    bpm: v.optional(v.number()),
    countIn: v.boolean(),
    subdivision: v.optional(v.number()),
    cueLeadBars: v.optional(v.number()),
    copyBase: v.optional(v.string()),
    sections: v.array(sectionFields),
  }).index("by_group", ["groupId"]),
  setlists: defineTable({
    groupId: v.id("groups"),
    name: v.string(),
    entries: v.array(
      v.object({
        songId: v.id("songs"),
        key: v.optional(v.string()),
        leader: v.optional(v.string()),
      }),
    ),
    revision: v.optional(v.number()),
  }).index("by_group", ["groupId"]),
  playbacks: defineTable({
    groupId: v.id("groups"),
    songId: v.id("songs"),
    song: v.object({ countIn: v.boolean(), subdivision: v.optional(v.number()), cueLeadBars: v.optional(v.number()), sections: v.array(sectionFields) }),
    startsAt: v.number(),
    startSection: v.number(),
    startBar: v.optional(v.number()),
    jumps: v.array(
      v.object({ at: v.number(), toSection: v.number(), cueFrom: v.optional(v.number()), vamp: v.optional(v.boolean()), pass: v.optional(v.number()) }),
    ),
    stopsAt: v.union(v.number(), v.null()),
    startedBy: v.id("users"),
    stoppedBy: v.optional(v.id("users")),
    advance: v.optional(v.boolean()),
    setlistIndex: v.optional(v.number()),
    advanceJob: v.optional(v.id("_scheduled_functions")),
  }).index("by_group", ["groupId"]),
  activity: defineTable({
    groupId: v.id("groups"),
    actorId: v.id("users"),
    actorName: v.string(),
    kind: activityKindValidator,
    summary: v.string(),
    details: v.optional(v.array(v.string())),
  })
    .index("by_group", ["groupId"])
    .index("by_group_kind", ["groupId", "kind"]),
  chat: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    displayName: v.string(),
    kind: chatKindValidator,
    text: v.string(),
  })
    .index("by_group_kind", ["groupId", "kind"])
    .index("by_group_user_kind", ["groupId", "userId", "kind"])
    .index("by_kind", ["kind"]),
  guestHandoffs: defineTable({
    guestId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_guest", ["guestId"]),
  subscriptions: defineTable({
    userId: v.id("users"),
    plan: v.union(paidPlanValidator, v.null()),
    expiresAt: v.union(v.number(), v.null()),
    store: v.optional(v.string()),
    syncedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_expires", ["expiresAt"]),
  presence: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    screenId: v.string(),
    onPlay: v.boolean(),
    roundTripMs: v.optional(v.number()),
    seenAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_group_user", ["groupId", "userId"])
    .index("by_group_user_screen", ["groupId", "userId", "screenId"])
    .index("by_group_seen", ["groupId", "seenAt"])
    .index("by_seen", ["seenAt"]),
});
