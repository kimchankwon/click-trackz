import { describe, expect, it } from "vitest";

import { describeAudioError, describeAudioFailure } from "./audio-failure";

const calm = { state: "suspended", waitedMs: 12, timedOut: false, resumeError: null, sessionError: null };

describe("describeAudioError", () => {
  it("uses the message of a plain error", () => {
    expect(describeAudioError(new Error("boom"))).toBe("boom");
  });

  it("adds the native domain, code and description when the library supplies them", () => {
    const error = Object.assign(new Error("Audio session activation failed"), {
      nativeErrorInfo: { nativeDomain: "NSOSStatusErrorDomain", nativeCode: 561015905, nativeDesc: "Session activation failed" },
    });
    expect(describeAudioError(error)).toBe(
      "Audio session activation failed (NSOSStatusErrorDomain 561015905: Session activation failed)",
    );
  });

  it("stringifies anything that is not an error", () => {
    expect(describeAudioError("nope")).toBe("nope");
  });
});

describe("describeAudioFailure", () => {
  it("names the context state when nothing else is known", () => {
    expect(describeAudioFailure(calm)).toBe("Audio is suspended");
  });

  it("says how long it waited when the context was still starting", () => {
    expect(describeAudioFailure({ ...calm, timedOut: true, waitedMs: 1003 })).toBe(
      "Audio is suspended. still starting after 1003 ms",
    );
  });

  it("includes the resume and audio session errors", () => {
    expect(describeAudioFailure({ ...calm, resumeError: "no output", sessionError: "denied" })).toBe(
      "Audio is suspended. resume failed: no output. audio session: denied",
    );
  });

  it("keeps the text short enough for a banner", () => {
    const text = describeAudioFailure({ ...calm, sessionError: "x".repeat(500) });
    expect(text.length).toBe(240);
    expect(text.endsWith("…")).toBe(true);
  });
});
