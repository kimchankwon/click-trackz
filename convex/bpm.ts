import { ConvexError, v } from "convex/values";

import { action, query } from "./_generated/server";

export const lookupAvailable = query({
  args: {},
  handler: async () => Boolean(process.env.GETSONGBPM_API_KEY),
});

type SearchResult = {
  title?: string;
  tempo?: string;
  time_sig?: string;
  key_of?: string;
  artist?: { name?: string };
};

export const lookup = action({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    if ((await ctx.auth.getUserIdentity()) === null) throw new ConvexError("Sign in first");
    const apiKey = process.env.GETSONGBPM_API_KEY;
    if (!apiKey) throw new ConvexError("BPM lookup is not set up");
    const query = title.trim();
    if (query.length === 0 || query.length > 80) throw new ConvexError("Type a Song title to look up");
    const url = `https://api.getsong.co/search/?api_key=${encodeURIComponent(apiKey)}&type=song&lookup=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) throw new ConvexError(`BPM lookup failed (${response.status})`);
    const body = (await response.json()) as { search?: SearchResult[] | { error?: string } };
    const results = Array.isArray(body.search) ? body.search : [];
    return results.slice(0, 5).map((result) => {
      const beats = Number.parseInt(result.time_sig ?? "", 10);
      return {
        title: result.title ?? query,
        artist: result.artist?.name ?? null,
        bpm: Number.parseFloat(result.tempo ?? "") || null,
        beatsPerBar: Number.isInteger(beats) && beats >= 1 && beats <= 12 ? beats : null,
        key: result.key_of ?? null,
      };
    });
  },
});
