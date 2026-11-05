import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  groups: defineTable({
    name: v.string(),
    joinCode: v.string(),
    createdBy: v.id("users"),
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
    countIn: v.boolean(),
    sections: v.array(
      v.object({
        sectionType: v.string(),
        number: v.optional(v.number()),
        bars: v.number(),
        beatsPerBar: v.number(),
        bpm: v.number(),
        voiceCueEnabled: v.optional(v.boolean()),
        customLabel: v.optional(v.string()),
      }),
    ),
  }).index("by_group", ["groupId"]),
  playbacks: defineTable({
    groupId: v.id("groups"),
    songId: v.id("songs"),
    startsAt: v.number(),
    startSection: v.number(),
    jumps: v.array(v.object({ at: v.number(), toSection: v.number() })),
    stopsAt: v.union(v.number(), v.null()),
    startedBy: v.id("users"),
  }).index("by_group", ["groupId"]),
});
