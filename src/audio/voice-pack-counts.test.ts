import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { MAX_SPOKEN_COUNT } from "@/sync/timeline";

const voiceDir = fileURLToPath(new URL("../../assets/voice", import.meta.url));

describe("Voice packs", () => {
  it("record every count the timeline can speak", () => {
    const folders = (dir: string) => readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const speeds = folders(voiceDir);
    expect(speeds.sort()).toEqual(["faster", "normal"]);
    for (const speed of speeds) {
      const speakers = folders(`${voiceDir}/${speed}`);
      expect(speakers.length).toBeGreaterThan(0);
      for (const speaker of speakers) {
        const files = new Set(readdirSync(`${voiceDir}/${speed}/${speaker}`));
        for (let count = 1; count <= MAX_SPOKEN_COUNT; count++) expect(files, `${speed}/${speaker} count-${count}`).toContain(`count-${count}.flac`);
      }
    }
  });
});
