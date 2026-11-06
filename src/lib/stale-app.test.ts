import { describe, expect, it } from "vitest";

import { entryScriptIn, isStaleAppError } from "./stale-app";

describe("isStaleAppError", () => {
  it("recognises errors from running an older version of the app", () => {
    expect(isStaleAppError(new Error('Requiring unknown module "762".'))).toBe(true);
    expect(isStaleAppError(new Error("Loading chunk 3 failed."))).toBe(true);
    expect(isStaleAppError(new Error("Failed to fetch dynamically imported module: /x.js"))).toBe(true);
    expect(isStaleAppError(new Error("[CONVEX Q(bpm:lookupAvailable)] Could not find public function for 'bpm:lookupAvailable'."))).toBe(true);
  });

  it("leaves ordinary errors alone", () => {
    expect(isStaleAppError(new Error("You are not in this Group"))).toBe(false);
    expect(isStaleAppError("Sign in first")).toBe(false);
  });
});

describe("entryScriptIn", () => {
  it("finds the web entry bundle a page loads", () => {
    const html = '<script src="/_expo/static/js/web/__common-4fb6.js" defer></script><script src="/_expo/static/js/web/entry-41f034db.js" defer></script>';
    expect(entryScriptIn(html)).toBe("/_expo/static/js/web/entry-41f034db.js");
    expect(entryScriptIn("<html></html>")).toBeNull();
  });
});
