import { describe, expect, it } from "vitest";

import { pingQuality } from "./ping-quality";

describe("pingQuality", () => {
  it("rates a round trip as good, weak or bad", () => {
    expect(pingQuality(20)).toBe("good");
    expect(pingQuality(80)).toBe("good");
    expect(pingQuality(81)).toBe("weak");
    expect(pingQuality(150)).toBe("weak");
    expect(pingQuality(151)).toBe("bad");
  });
});
