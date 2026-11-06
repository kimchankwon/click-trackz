import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import type { StyleProp, ViewStyle } from "react-native";

import type { ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const symbols = {
  play: { ios: "play.fill", material: "play_arrow" },
  stop: { ios: "stop.fill", material: "stop" },
  back: { ios: "chevron.left", material: "arrow_back" },
  forward: { ios: "chevron.right", material: "chevron_right" },
  expand: { ios: "chevron.down", material: "expand_more" },
  up: { ios: "arrow.up", material: "arrow_upward" },
  down: { ios: "arrow.down", material: "arrow_downward" },
  trash: { ios: "trash", material: "delete" },
  add: { ios: "plus", material: "add" },
  minus: { ios: "minus", material: "remove" },
  check: { ios: "checkmark", material: "check" },
  star: { ios: "star.fill", material: "star" },
  starOutline: { ios: "star", material: "star_outline" },
  sound: { ios: "speaker.wave.2.fill", material: "volume_up" },
  songs: { ios: "music.note.list", material: "queue_music" },
  group: { ios: "person.2.fill", material: "group" },
  pulse: { ios: "waveform", material: "graphic_eq" },
  ping: { ios: "cellularbars", material: "signal_cellular_alt" },
  mic: { ios: "mic.fill", material: "mic" },
  edit: { ios: "pencil", material: "edit" },
  headphones: { ios: "headphones", material: "headphones" },
  speed: { ios: "speedometer", material: "speed" },
  upload: { ios: "square.and.arrow.up", material: "upload" },
  logout: { ios: "rectangle.portrait.and.arrow.right", material: "logout" },
  person: { ios: "person.crop.circle", material: "account_circle" },
  touch: { ios: "hand.tap.fill", material: "touch_app" },
  playCircle: { ios: "play.circle.fill", material: "play_circle" },
  admin: { ios: "checkmark.shield.fill", material: "verified_user" },
  library: { ios: "books.vertical", material: "library_music" },
  next: { ios: "arrow.turn.down.right", material: "subdirectory_arrow_right" },
  numbered: { ios: "textformat.123", material: "123" },
  phone: { ios: "iphone", material: "smartphone" },
  metronome: { ios: "metronome", material: "av_timer" },
  speaking: { ios: "person.wave.2", material: "record_voice_over" },
  counter: { ios: "1.circle", material: "counter_1" },
  member: { ios: "person.fill", material: "person" },
  warning: { ios: "exclamationmark.triangle.fill", material: "warning" },
  stopFilled: { ios: "stop.fill", material: "stop_circle" },
  previousSong: { ios: "backward.end.fill", material: "skip_previous" },
  nextSong: { ios: "forward.end.fill", material: "skip_next" },
  copy: { ios: "doc.on.doc", material: "content_copy" },
  share: { ios: "square.and.arrow.up", material: "share" },
} as const satisfies Record<string, { ios: SFSymbol; material: AndroidSymbol }>;

export type IconName = keyof typeof symbols;

export function Icon({
  name,
  size = 22,
  color = "text",
  tint,
  style,
}: {
  name: IconName;
  size?: number;
  color?: ThemeColor;
  tint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const symbol = symbols[name];
  return (
    <SymbolView
      name={{ ios: symbol.ios, android: symbol.material, web: symbol.material }}
      size={size}
      tintColor={tint ?? theme[color]}
      style={style}
    />
  );
}
