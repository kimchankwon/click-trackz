import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("remove guests who have not come back", { minutes: 10 }, internal.presence.removeAbsentGuests, {});
crons.interval("forget screens that stopped sending heartbeats", { minutes: 10 }, internal.presence.forgetOldScreens, {});
crons.interval("forget guests who never joined a Group", { hours: 1 }, internal.presence.forgetGuestsWhoNeverJoined, {});
crons.interval("forget Reactions once they have floated away", { minutes: 10 }, internal.chat.forgetOldReactions, {});
crons.interval("re-check subscriptions about to expire", { hours: 1 }, internal.subscriptions.recheckExpiring, {});

export default crons;
