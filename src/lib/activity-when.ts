import { timeAgo } from "./time-ago";

const DAY = 24 * 60 * 60_000;

export function activityWhen(at: number, nowMs: number, locale?: string, timeZone?: string): string {
  if (nowMs - at < DAY) return timeAgo(Math.max(0, nowMs - at));
  const sameYear = new Date(at).getFullYear() === new Date(nowMs).getFullYear();
  return new Date(at).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}
