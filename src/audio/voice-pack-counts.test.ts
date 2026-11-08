import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { MAX_SPOKEN_COUNT } from "@/sync/timeline";

const voiceDir = fileURLToPath(new URL("../../assets/voice", import.meta.url));

describe("Voice packs", () => {
  it("record every count the timeline can speak", () => {
    const speakers = readdirSync(voiceDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    expect(speakers.length).toBeGreaterThan(0);
    for (const speaker of speakers) {
      const files = new Set(readdirSync(`${voiceDir}/${speaker.name}`));
      for (let count = 1; count <= MAX_SPOKEN_COUNT; count++) expect(files, `${speaker.name} count-${count}`).toContain(`count-${count}.wav`);
    }
  });
});
