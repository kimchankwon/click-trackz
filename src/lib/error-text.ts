import { ConvexError } from "convex/values";

export function errorText(error: unknown): string {
  if (error instanceof ConvexError) return String(error.data);
  return error instanceof Error ? error.message : String(error);
}
