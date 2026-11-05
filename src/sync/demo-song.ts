import type { Song } from "./timeline";

export const demoSong: Song = {
  countIn: true,
  sections: [
    { sectionType: "Intro", bars: 2, beatsPerBar: 4, bpm: 96 },
    { sectionType: "Verse", number: 1, bars: 4, beatsPerBar: 4, bpm: 96 },
    { sectionType: "Pre-Chorus", bars: 2, beatsPerBar: 4, bpm: 96 },
    { sectionType: "Chorus", bars: 4, beatsPerBar: 4, bpm: 96 },
    { sectionType: "Bridge", bars: 2, beatsPerBar: 3, bpm: 72 },
    { sectionType: "Outro", bars: 2, beatsPerBar: 4, bpm: 96 },
  ],
};
