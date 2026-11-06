import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const sectionFields = v.object({
  sectionType: v.string(),
  number: v.optional(v.number()),
  bars: v.number(),
  beatsPerBar: v.number(),
  bpm: v.number(),
  voiceCueEnabled: v.optional(v.boolean()),
  customLabel: v.optional(v.string()),
});

export default defineSchema({
  ...authTables,
  groups: defineTable({
    name: v.string(),
    joinCode: v.string(),
    createdBy: v.id("users"),
    currentSetlistId: v.optional(v.id("setlists")),
  }).index("by_join_code", ["joinCode"]),
  memberships: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    displayName: v.string(),
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_user", ["groupId", "userId"]),
  songs: defineTable({
    groupId: v.id("groups"),
    title: v.string(),
    key: v.optional(v.string()),
    tempoHint: v.optional(v.object({ bpm: v.number(), beatsPerBar: v.number() })),
    countIn: v.boolean(),
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
  recordings: defineTable({
    groupId: v.id("groups"),
    key: v.string(),
    word: v.string(),
    number: v.optional(v.number()),
    storageId: v.id("_storage"),
  })
    .index("by_group", ["groupId"])
    .index("by_group_key", ["groupId", "key"])
    .index("by_storage", ["storageId"]),
  playbacks: defineTable({
    groupId: v.id("groups"),
    songId: v.id("songs"),
    song: v.object({ countIn: v.boolean(), sections: v.array(sectionFields) }),
    startsAt: v.number(),
    startSection: v.number(),
    jumps: v.array(v.object({ at: v.number(), toSection: v.number() })),
    stopsAt: v.union(v.number(), v.null()),
    startedBy: v.id("users"),
  }).index("by_group", ["groupId"]),
  presence: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    screenId: v.string(),
    onPlay: v.boolean(),
    seenAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_group_user", ["groupId", "userId"])
    .index("by_group_user_screen", ["groupId", "userId", "screenId"]),
});
