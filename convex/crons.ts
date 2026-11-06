import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("remove guests who have not come back", { minutes: 10 }, internal.presence.removeAbsentGuests, {});

export default crons;
