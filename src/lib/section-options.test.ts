import { describe, expect, it } from "vitest";

import { bpmOptions, LETTER_OPTIONS, NUMBER_OPTIONS, PLAYS_OPTIONS, timeOfKey, timeOptions } from "./section-options";

describe("Section options", () => {
  it("offers letters A to E after None", () => {
    expect(LETTER_OPTIONS.map((option) => option.label)).toEqual(["None", "A", "B", "C", "D", "E"]);
  });

  it("offers numbers 1 to 9 after None, and Plays from once to the most", () => {
    expect(NUMBER_OPTIONS.map((option) => option.value)).toEqual(["none", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect(PLAYS_OPTIONS[0]).toEqual({ value: "1", label: "×1" });
    expect(PLAYS_OPTIONS.at(-1)).toEqual({ value: "16", label: "×16" });
  });

  it("puts the Song tempo first, then every whole BPM the server takes", () => {
    const options = bpmOptions(120, null);
    expect(options[0]).toEqual({ value: "song", label: "Song tempo (120)" });
    expect(options[1].value).toBe("30");
    expect(options.at(-1)?.value).toBe("300");
  });

  it("keeps a Section's own tempo in the list when it is not a whole number", () => {
    const values = bpmOptions(120, 72.5).map((option) => option.value);
    expect(values.slice(values.indexOf("72"), values.indexOf("72") + 3)).toEqual(["72", "72.5", "73"]);
  });

  it("lists a time signature outside the common ones first, and reads a choice back", () => {
    expect(timeOptions({ beatsPerBar: 11, beatUnit: 8 })[0].value).toBe("11/8");
    expect(timeOptions({ beatsPerBar: 4 }).filter((option) => option.value === "4/4")).toHaveLength(1);
    expect(timeOfKey("7/8")).toEqual({ beatsPerBar: 7, beatUnit: 8 });
  });
});
