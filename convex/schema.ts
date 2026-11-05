import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  playbacks: defineTable({
    key: v.string(),
    startsAt: v.number(),
    startSection: v.number(),
    jumps: v.array(v.object({ at: v.number(), toSection: v.number() })),
    stopsAt: v.union(v.number(), v.null()),
    startedBy: v.id("users"),
  }).index("by_key", ["key"]),
});
