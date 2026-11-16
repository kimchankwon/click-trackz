import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import { errorText } from "./error-text";

describe("errorText", () => {
  it("gives the message the server wrote", () => {
    expect(errorText(new ConvexError("Sign in first"))).toBe("Sign in first");
  });

  it("hides a validator dump behind a plain sentence", () => {
    const dump = new Error('[CONVEX Q(songs:get)] ArgumentValidationError: Value does not match validator.\nPath: .songId\nValue: "notasong"\nValidator: v.id("songs")');
    expect(errorText(dump)).toBe("That link does not lead anywhere in Click Trackz. Check it, or go back and open it from the app.");
  });
});
