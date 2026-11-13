import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionButton } from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/ui/icon";
import { LogoMark } from "@/components/ui/logo-mark";
import { Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { ControlCenterMock } from "./control-center-mock";
import { PageScroll } from "./page-scroll";
import { MiniDevice, PlayScreenMock } from "./device-mocks";
import { TimingDiagram } from "./timing-diagram";
import { useDemoBeat } from "./use-demo-beat";

const PAGE_WIDTH = 1120;
const WIDE_FROM = 900;

const STEPS = [
  { when: "Press", title: "Start is pressed", body: "Someone running Playback taps Start on their device." },
  { when: "One second", title: "Every device is told", body: "The Song starts one second ahead, on the next bar line, so every device hears about it first." },
  { when: "Bar 1", title: "Everyone plays together", body: "Each device plays the downbeat from a clock matched to the server. Same Click, same Count, same moment." },
] as const;

const CONTROLS: readonly { icon: IconName; title: string; body: string }[] = [
  { icon: "play", title: "Play", body: "Starts the Song for the whole Group." },
  { icon: "pause", title: "Pause", body: "Stops it for everyone, a second after you press it." },
  { icon: "nextSong", title: "Skip", body: "Jumps to the next or previous Section on the next bar line." },
  { icon: "headphones", title: "Headphone button", body: "Plays and pauses from your earbuds or headphones." },
];

const FEATURES: readonly { icon: IconName; title: string; body: string }[] = [
  { icon: "songs", title: "Sections your way", body: "Name each Section, number it and give it a letter, like Chorus 1A. Set its bars, time signature, time changes, tempo and how many times it plays." },
  { icon: "metronome", title: "The Click", body: "Up to four clicks per beat, accents on every bar and an optional Count-in." },
  { icon: "speaking", title: "Voice cues", body: "A Speaker calls the next Section one or two bars before it, so nobody misses the change." },
  { icon: "counter", title: "The Count", body: "CHORUS1, then 2 3 4. The Section on its downbeat, then the bar and the beat, big enough to read mid-song." },
  { icon: "vamp", title: "Steer it live", body: "Jump, Repeat or Vamp a Section. Every change lands on a bar line, for everyone at once." },
  { icon: "library", title: "Setlists", body: "Line up the Songs for the night, with each Song's Key and Leader." },
  { icon: "headphones", title: "Stereo split", body: "Click in one ear and Voice cues in the other, for split in-ear monitors." },
  { icon: "speed", title: "Latency nudge", body: "Line Bluetooth headphones up with the rest of the band in a few taps." },
  { icon: "haptic", title: "Haptic beat", body: "Feel the downbeat, or every beat, as a tap on your phone." },
  { icon: "group", title: "Roles", body: "Give each Member the Role they need, from following along to running Playback and editing Songs." },
  { icon: "phone", title: "My Library", body: "Your own Songs on your own device, for practising alone with no connection." },
];

function Section({ children, tinted, id }: { children: ReactNode; tinted?: boolean; id?: string }) {
  const theme = useTheme();
  return (
    <View nativeID={id} style={[styles.band, tinted ? { backgroundColor: theme.backgroundElement } : null]}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <ThemedText type="label" themeColor="accent" style={styles.eyebrow}>
      {children}
    </ThemedText>
  );
}

function Heading({ children, wide }: { children: string; wide: boolean }) {
  return (
    <ThemedText role="heading" aria-level={2} style={[styles.h2, wide ? styles.h2Wide : null]}>
      {children}
    </ThemedText>
  );
}

function CountBand({ onGetStarted, label }: { onGetStarted: () => void; label: string }) {
  const theme = useTheme();
  const beat = useDemoBeat();
  const pop = useSharedValue(1);
  useEffect(() => {
    pop.value = withSequence(withTiming(1.12, { duration: 60 }), withTiming(1, { duration: 280 }));
  }, [beat.index, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <View style={[styles.band, { backgroundColor: theme.accent }]}>
      <View style={[styles.inner, styles.countInner]}>
        <View style={styles.countRow} aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            <Animated.View key={n} style={n === beat.beatInBar ? popStyle : null}>
              <Text style={[styles.bigCount, { color: theme.onAccent, opacity: n === beat.beatInBar ? 1 : 0.35 }]}>{n}</Text>
            </Animated.View>
          ))}
        </View>
        <ThemedText role="heading" aria-level={2} style={[styles.h2, styles.centered, { color: theme.onAccent }]}>
          Count the band in together.
        </ThemedText>
        <ActionButton large variant="inverse" label={label} testID="about-get-started-bottom" onPress={onGetStarted} />
      </View>
    </View>
  );
}

export function AboutPage({ signedIn, onGetStarted }: { signedIn: boolean; onGetStarted: () => void }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_FROM;
  const startLabel = signedIn ? "Open your Groups" : "Get started";
  const phoneWidth = wide ? 300 : Math.min(280, width - Spacing.four * 2);
  const miniWidth = wide ? 150 : Math.max(84, Math.floor((width - Spacing.four * 2 - Spacing.three * 2) / 3.4));
  return (
    <PageScroll style={[styles.page, { backgroundColor: theme.background }]} testID="about-page">
      <SafeAreaView edges={["top", "left", "right"]}>
        <View style={[styles.inner, styles.header]}>
          <View style={styles.brandRow}>
            <LogoMark size={36} />
            <ThemedText style={styles.brand}>Click Trackz</ThemedText>
          </View>
          <ActionButton small variant={signedIn ? "outline" : "inverse"} label={signedIn ? "Back to Groups" : "Log in"} testID="about-log-in" onPress={onGetStarted} />
        </View>
      </SafeAreaView>

      <Section>
        <View style={[styles.hero, wide ? styles.heroWide : null]}>
          <View style={[styles.heroCopy, wide ? styles.heroCopyWide : null]}>
            <Eyebrow>Click Trackz</Eyebrow>
            <ThemedText role="heading" aria-level={1} style={[styles.h1, wide ? styles.h1Wide : null, wide ? null : styles.centered]}>
              Multiple devices, one beat
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={[styles.lead, wide ? null : styles.centered]}>
              Click Trackz keeps every device completely in sync, even through different connection speeds.
            </ThemedText>
            <View style={wide ? styles.buttonStart : styles.buttonCenter}>
              <ActionButton large accent label={startLabel} testID="about-get-started" onPress={onGetStarted} />
            </View>
          </View>
          <PlayScreenMock width={phoneWidth} />
        </View>
      </Section>

      <Section tinted id="timing">
        <View style={styles.sectionHead}>
          <Eyebrow>In sync</Eyebrow>
          <Heading wide={wide}>Every device starts on the same timing</Heading>
          <ThemedText themeColor="textSecondary" style={styles.body}>
            Beats never travel over the network. Each device keeps its clock matched to the server and plays every beat itself, so a slow connection never pushes anyone off the beat.
          </ThemedText>
        </View>
        <View style={styles.devices}>
          <MiniDevice kind="phone" label="Drums · iPhone" width={miniWidth} />
          <MiniDevice kind="tablet" label="Keys · iPad" width={Math.round(miniWidth * 1.45)} />
          <MiniDevice kind="phone" label="Bass · Android" width={miniWidth} />
        </View>
        <TimingDiagram />
        <View style={styles.steps}>
          {STEPS.map((step) => (
            <View key={step.when} style={styles.step}>
              <View style={styles.stepRail}>
                <View style={[styles.stepDot, { backgroundColor: theme.accent }]} />
                <View style={[styles.stepLine, { backgroundColor: theme.border }]} />
              </View>
              <ThemedText type="label" themeColor="accent">
                {step.when}
              </ThemedText>
              <ThemedText type="heading">{step.title}</ThemedText>
              <ThemedText themeColor="textSecondary">{step.body}</ThemedText>
            </View>
          ))}
        </View>
      </Section>

      <Section>
        <View style={[styles.split, wide ? styles.splitWide : null]}>
          <View style={[styles.splitCopy, wide ? styles.splitCopyWide : null]}>
            <Eyebrow>Full control</Eyebrow>
            <Heading wide={wide}>Control the beats from anywhere</Heading>
            <ThemedText themeColor="textSecondary" style={styles.body}>
              Use the Control Center, or even the buttons on your audio device.
            </ThemedText>
            <View style={styles.controlList}>
              {CONTROLS.map((control) => (
                <View key={control.title} style={styles.controlRow}>
                  <View style={[styles.iconTile, { backgroundColor: theme.accentTint }]}>
                    <Icon name={control.icon} size={18} color="accent" />
                  </View>
                  <View style={styles.grow}>
                    <ThemedText type="smallBold">{control.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {control.body}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
            <ThemedText type="caption" themeColor="textSecondary">
              On iPhone. Members who do not run Playback can mute their own device from there.
            </ThemedText>
          </View>
          <View style={[styles.mockStage, { backgroundColor: theme.backgroundElement }]}>
            <ControlCenterMock />
          </View>
        </View>
      </Section>

      <Section tinted>
        <View style={styles.sectionHead}>
          <Eyebrow>Everything the band needs</Eyebrow>
          <Heading wide={wide}>From rehearsals to the stage</Heading>
        </View>
        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={[styles.feature, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={[styles.iconTile, { backgroundColor: theme.accentTint }]}>
                <Icon name={feature.icon} size={18} color="accent" />
              </View>
              <ThemedText type="heading">{feature.title}</ThemedText>
              <ThemedText themeColor="textSecondary">{feature.body}</ThemedText>
            </View>
          ))}
        </View>
      </Section>

      <CountBand onGetStarted={onGetStarted} label={startLabel} />

      <View style={[styles.inner, styles.footer]}>
        <ThemedText type="caption" themeColor="textSecondary">
          Click Trackz
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          iPhone, Android and web
        </ThemedText>
      </View>
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1 },
  band: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.six },
  inner: { width: "100%", maxWidth: PAGE_WIDTH, alignSelf: "center", gap: Spacing.five },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.three },
  brandRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  brand: { fontFamily: Fonts.display, fontSize: 19, lineHeight: 24, fontWeight: "800" },
  hero: { alignItems: "center", gap: Spacing.five },
  heroWide: { flexDirection: "row", justifyContent: "space-between" },
  heroCopy: { gap: Spacing.three, alignItems: "center", maxWidth: 560 },
  heroCopyWide: { flex: 1, alignItems: "flex-start" },
  eyebrow: { letterSpacing: 1.6 },
  h1: { fontFamily: Fonts.display, fontSize: 44, lineHeight: 48, fontWeight: "800", letterSpacing: -1.2 },
  h1Wide: { fontSize: 76, lineHeight: 78, letterSpacing: -2.5 },
  lead: { fontSize: 19, lineHeight: 28, maxWidth: 520 },
  buttonStart: { alignSelf: "flex-start", paddingTop: Spacing.two },
  buttonCenter: { alignSelf: "stretch", paddingTop: Spacing.two },
  centered: { textAlign: "center" },
  sectionHead: { gap: Spacing.two, maxWidth: 720 },
  h2: { fontFamily: Fonts.display, fontSize: 32, lineHeight: 36, fontWeight: "800", letterSpacing: -0.8 },
  h2Wide: { fontSize: 48, lineHeight: 52, letterSpacing: -1.4 },
  body: { fontSize: 17, lineHeight: 26 },
  devices: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: Spacing.three },
  steps: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.four },
  step: { flexGrow: 1, flexBasis: 240, minWidth: 0, gap: Spacing.two },
  stepRail: { flexDirection: "row", alignItems: "center", gap: Spacing.two, marginBottom: Spacing.one },
  stepDot: { width: 14, height: 14, borderRadius: 7 },
  stepLine: { flex: 1, height: 2 },
  split: { gap: Spacing.five },
  splitWide: { flexDirection: "row", alignItems: "center" },
  splitCopy: { gap: Spacing.three },
  splitCopyWide: { flex: 1 },
  controlList: { gap: Spacing.three, paddingVertical: Spacing.two },
  controlRow: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  iconTile: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1, minWidth: 0 },
  mockStage: { flex: 1, minWidth: 0, gap: Spacing.three, borderRadius: Radius.lg + 8, paddingVertical: Spacing.six, paddingHorizontal: Spacing.four, alignItems: "center", justifyContent: "center" },
  features: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.three },
  feature: { flexGrow: 1, flexBasis: 260, minWidth: 0, gap: Spacing.two, padding: Spacing.four, borderRadius: Radius.lg, borderWidth: 1 },
  countInner: { alignItems: "center", gap: Spacing.four },
  countRow: { flexDirection: "row", gap: Spacing.five },
  bigCount: { fontFamily: Fonts.condensed, fontWeight: "700", fontSize: 96, lineHeight: 100, fontVariant: ["tabular-nums"] },
  footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: Spacing.four, paddingVertical: Spacing.four },
});
