import { ConvexError } from "convex/values";

export function errorText(error: unknown): string {
  if (error instanceof ConvexError) return String(error.data);
  const text = error instanceof Error ? error.message : String(error);
  return text.includes("ArgumentValidationError") ? "That link does not lead anywhere in Click Trackz. Check it, or go back and open it from the app." : text;
}
