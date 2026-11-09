import { mutation } from "./_generated/server";
import { requireUser } from "./access";

export const now = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return Date.now();
  },
});
