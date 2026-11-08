import { beatsBetween, type Beat, type Section } from "./timeline";

const wordOf = (beat: Beat) => (beat.voiceCue ? beat.voiceCue.sectionType.toUpperCase() : beat.spokenCount === null ? "." : String(beat.spokenCount));

export function cuePattern(time: Pick<Section, "beatsPerBar" | "beatUnit">, cueLeadBars: number): string {
  const bar = { bars: 2, beatsPerBar: time.beatsPerBar, beatUnit: time.beatUnit, bpm: 120 };
  const song = { countIn: false, cueLeadBars, sections: [{ sectionType: "Verse", ...bar }, { sectionType: "Chorus", ...bar }] };
  const lead = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, Infinity).filter((beat) => beat.lead?.cue?.sectionType === "Chorus");
  return lead.map((beat, index) => `${index > 0 && beat.beatInBar === 1 ? "| " : ""}${wordOf(beat)}`).join(" ");
}
