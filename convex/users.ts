import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

import { isAccentId } from "./accents";
import { mutation, query } from "./_generated/server";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (user === null) return null;
    return {
      id: user._id,
      isAnonymous: user.isAnonymous === true,
      accent: isAccentId(user.accent) ? user.accent : null,
    };
  },
});

export const setAccent = mutation({
  args: { accent: v.string() },
  handler: async (ctx, { accent }) => {
    if (!isAccentId(accent)) throw new ConvexError("Unknown colour");
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Sign in to save your colour");
    const user = await ctx.db.get(userId);
    if (user === null) throw new ConvexError("Sign in to save your colour");
    if (user.isAnonymous === true) throw new ConvexError("Sign in with Google to save your colour to your profile");
    await ctx.db.patch(userId, { accent });
  },
});
