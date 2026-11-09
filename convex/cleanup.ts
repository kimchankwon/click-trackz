import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { isGuest } from "./access";

export async function deleteGroupRows(ctx: MutationCtx, groupId: Id<"groups">) {
  const rows = await Promise.all([
    ctx.db.query("songs").withIndex("by_group", (q) => q.eq("groupId", groupId)).collect(),
    ctx.db.query("setlists").withIndex("by_group", (q) => q.eq("groupId", groupId)).collect(),
    ctx.db.query("playbacks").withIndex("by_group", (q) => q.eq("groupId", groupId)).collect(),
    ctx.db.query("presence").withIndex("by_group", (q) => q.eq("groupId", groupId)).collect(),
    ctx.db.query("memberships").withIndex("by_group", (q) => q.eq("groupId", groupId)).collect(),
  ]);
  await Promise.all(rows.flat().map((row) => ctx.db.delete(row._id)));
  await ctx.db.delete(groupId);
}

async function deleteUserRows(ctx: MutationCtx, userId: Id<"users">) {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();
  for (const session of sessions) {
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    await Promise.all(tokens.map((token) => ctx.db.delete(token._id)));
    await ctx.db.delete(session._id);
  }
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();
  await Promise.all(accounts.map((account) => ctx.db.delete(account._id)));
  await ctx.db.delete(userId);
}

async function offlineHasContent(ctx: MutationCtx, groupId: Id<"groups">) {
  const song = await ctx.db
    .query("songs")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .first();
  if (song !== null) return true;
  const setlist = await ctx.db
    .query("setlists")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .first();
  return setlist !== null;
}

export async function forgetGuestIfGone(ctx: MutationCtx, userId: Id<"users">): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (user === null || !isGuest(user)) return false;
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const offlineGroups: Id<"groups">[] = [];
  for (const membership of memberships) {
    const group = await ctx.db.get(membership.groupId);
    if (group === null) {
      await ctx.db.delete(membership._id);
      continue;
    }
    if (group.offline !== true) return false;
    if (await offlineHasContent(ctx, group._id)) return false;
    offlineGroups.push(group._id);
  }
  for (const groupId of offlineGroups) await deleteGroupRows(ctx, groupId);
  await deleteUserRows(ctx, userId);
  return true;
}
