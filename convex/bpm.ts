import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { action, internalQuery, query } from "./_generated/server";
import { requireAdmin } from "./access";

const LOOKUP_TIMEOUT_MS = 8000;

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

export const checkAdmin = internalQuery({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireAdmin(ctx, groupId);
  },
});

const isAbort = (error: unknown) => error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");

type SearchBody = { search?: SearchResult[] | { error?: string } };

async function fetchSearch(url: string): Promise<SearchBody> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new ConvexError(`BPM lookup failed (${response.status})`);
    return (await response.json()) as SearchBody;
  } catch (error) {
    if (isAbort(error)) throw new ConvexError("GetSongBPM took too long to answer. Try again in a moment.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const lookup = action({
  args: { groupId: v.id("groups"), title: v.string() },
  handler: async (ctx, { groupId, title }) => {
    await ctx.runQuery(internal.bpm.checkAdmin, { groupId });
    const apiKey = process.env.GETSONGBPM_API_KEY;
    if (!apiKey) throw new ConvexError("BPM lookup is not set up");
    const query = title.trim();
    if (query.length === 0 || query.length > 80) throw new ConvexError("Type a Song title to look up");
    const url = `https://api.getsong.co/search/?api_key=${encodeURIComponent(apiKey)}&type=song&lookup=${encodeURIComponent(query)}`;
    const body = await fetchSearch(url);
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
