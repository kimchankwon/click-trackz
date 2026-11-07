import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("remove guests who have not come back", { minutes: 10 }, internal.presence.removeAbsentGuests, {});
crons.interval("forget screens that stopped sending heartbeats", { minutes: 10 }, internal.presence.forgetOldScreens, {});

export default crons;
