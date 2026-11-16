import { describe, expect, it } from "vitest";

import { browserLabel } from "./browser-label";
import { isDeviceId, trimDeviceLabel } from "./device-identity";

describe("browserLabel", () => {
  it("names the browser and the system it runs on", () => {
    expect(browserLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36")).toBe("Chrome on Mac");
    expect(browserLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari on iPhone");
    expect(browserLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0")).toBe("Edge on Windows");
    expect(browserLabel("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36")).toBe("Chrome on Android");
    expect(browserLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0 Mobile/15E148 Safari/604.1")).toBe("Chrome on iPhone");
  });

  it("falls back to a plain name for an unknown agent", () => {
    expect(browserLabel("")).toBe("Browser");
  });

  it("keeps a label short", () => {
    expect(trimDeviceLabel(`  ${"x".repeat(60)} `)).toHaveLength(40);
  });

  it("accepts only the device ids this app makes", () => {
    expect(isDeviceId("mi3k2x9a4f8q0z7c")).toBe(true);
    expect(isDeviceId("short")).toBe(false);
    expect(isDeviceId("Has Spaces 1234")).toBe(false);
  });
});
