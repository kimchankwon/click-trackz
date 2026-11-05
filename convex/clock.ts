import { mutation } from "./_generated/server";

export const now = mutation({
  args: {},
  handler: async () => Date.now(),
});
