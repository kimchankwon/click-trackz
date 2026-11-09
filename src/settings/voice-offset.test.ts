import { describe, expect, it } from "vitest";

import { isVoiceOffsetSetting, stepVoiceOffset, voiceOffsetText } from "./voice-offset";

describe("Voice cue offset", () => {
  it("steps 10 ms at a time and stops at 200 ms either way", () => {
    expect(stepVoiceOffset(0, 1)).toBe(10);
    expect(stepVoiceOffset(10, -2)).toBe(-10);
    expect(stepVoiceOffset(200, 1)).toBe(200);
    expect(stepVoiceOffset(-200, -1)).toBe(-200);
    expect(stepVoiceOffset(14, 1)).toBe(20);
  });

  it("names the offset in words", () => {
    expect(voiceOffsetText(0)).toBe("Default");
    expect(voiceOffsetText(30)).toBe("30 ms later");
    expect(voiceOffsetText(-20)).toBe("20 ms sooner");
  });

  it("accepts only stored offsets inside the range", () => {
    expect(isVoiceOffsetSetting("-40")).toBe(true);
    expect(isVoiceOffsetSetting("250")).toBe(false);
    expect(isVoiceOffsetSetting("ten")).toBe(false);
  });
});
