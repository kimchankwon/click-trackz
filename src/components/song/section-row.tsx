import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { LetterStepper, NumberStepper } from "@/components/ui/stepper-input";
import { Switch } from "@/components/ui/switch";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { MAX_BPM, MIN_BPM } from "@/lib/song-draft";
import { MoveHandle } from "@/components/song/move-handle";
import { sameTime, type TimeSignature } from "@/sync/song-time";
import { newTimeChange } from "@/sync/time-changes";
import { MAX_SECTION_NUMBER, timeOfKey, timeOptions } from "@/lib/section-options";
import { MAX_BARS, MAX_PLAYS, playsOf, timeSignatureOf, type Section, type SectionLetter, type TimeChange } from "@/sync/timeline";

const STEPPER_WIDTH = 56;
const TAG_WIDTH = 44;
const LETTER_WIDTH = 48;
const BARS_WIDTH = 50;
const BARS_RANGE = { min: 1, max: MAX_BARS };
const PLAYS_RANGE = { min: 1, max: MAX_PLAYS };
const SECTION_BPM_RANGE = { min: MIN_BPM, max: MAX_BPM, optional: true };
const SECTION_NUMBER_RANGE = { min: 1, max: MAX_SECTION_NUMBER, optional: true };

export type EditableSection = Section & { customLabel?: string; ownTempo?: boolean; ownTime?: boolean };

function withPlays(section: EditableSection, plays: number): EditableSection {
  const next = Math.min(MAX_PLAYS, Math.max(1, plays));
  return { ...section, plays: next > 1 ? next : undefined };
}

const FOLLOW_SONG = "song";

function LabeledField({ label, width, children }: { label: string; width?: number; children: ReactNode }) {
  return (
    <View style={width === undefined ? styles.field : [styles.fixedField, { width }]}>
      <ThemedText themeColor="textSecondary" style={[styles.fieldLabel, width === undefined ? null : styles.centeredLabel]} numberOfLines={1}>
        {label}
      </ThemedText>
      <View style={styles.fieldBody}>{children}</View>
    </View>
  );
}

export function TimeSignatureField({ section, testID, onChange }: { section: TimeSignature; testID: string; onChange: (next: TimeSignature) => void }) {
  return (
    <LabeledField label="Time">
      <Dropdown
        look="field"
        label="Time signature"
        testID={testID}
        menuMinWidth={MENU_MIN_WIDTH}
        options={timeOptions(section)}
        value={timeSignatureOf(section)}
        onChange={(key) => onChange(timeOfKey(key))}
      />
    </LabeledField>
  );
}

function TimeChangeRow({ change, sectionBars, testID, onChange, onRemove }: { change: TimeChange; sectionBars: number; testID: string; onChange: (next: TimeChange) => void; onRemove: () => void }) {
  const theme = useTheme();
  const startRange = { min: 1, max: Math.max(1, sectionBars - change.bars + 1) };
  const lengthRange = { min: 1, max: Math.max(1, sectionBars - change.bar + 1) };
  return (
    <View style={[styles.changeRow, { backgroundColor: theme.background }]} testID={testID}>
      <LabeledField label="At bar" width={STEPPER_WIDTH}>
        <NumberStepper label="From bar" testID={`${testID}-bar`} value={change.bar} range={startRange} onChange={(bar) => onChange({ ...change, bar: bar ?? change.bar })} />
      </LabeledField>
      <LabeledField label="Bars" width={STEPPER_WIDTH}>
        <NumberStepper label="Bars" testID={`${testID}-bars`} value={change.bars} range={lengthRange} onChange={(bars) => onChange({ ...change, bars: bars ?? change.bars })} />
      </LabeledField>
      <TimeSignatureField section={change} testID={`${testID}-time`} onChange={(time) => onChange({ ...change, ...time })} />
      <IconButton icon="trash" color="textTertiary" size={40} label={`Remove the time change at bar ${change.bar}`} onPress={onRemove} testID={`${testID}-remove`} />
    </View>
  );
}

export type SectionRowState = { id: number; section: EditableSection };

export function NumberField({ label, value, onChange, testID, integer = false }: { label: string; value: number; onChange: (next: number) => void; testID: string; integer?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field
      label={label}
      testID={testID}
      value={draft ?? String(value)}
      inputMode={integer ? "numeric" : "decimal"}
      onFocus={() => setDraft(String(value))}
      onBlur={() => setDraft(null)}
      onChangeText={(next) => {
        setDraft(next);
        const parsed = Number(next);
        if (next.trim() !== "" && Number.isFinite(parsed)) onChange(parsed);
      }}
      containerStyle={styles.numberField}
      style={styles.numberInput}
      compact
      inset
    />
  );
}

const MENU_MIN_WIDTH = 120;

export function SectionRow({
  section,
  songBpm,
  songTime,
  index,
  count,
  vocabulary,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  section: EditableSection;
  songBpm: number;
  songTime: TimeSignature;
  index: number;
  count: number;
  vocabulary: readonly string[];
  onChange: (next: EditableSection) => void;
  onMove: (by: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const plays = playsOf(section);
  const changes = section.timeChanges ?? [];
  const addedChange = newTimeChange(section);
  const updateChanges = (timeChanges: TimeChange[]) => onChange({ ...section, timeChanges: timeChanges.length > 0 ? timeChanges : undefined });
  const ownTempo = section.ownTempo === true;
  const ownTime = section.ownTime === true;
  const [bpmOpen, setBpmOpen] = useState(false);
  const showBpm = ownTempo || bpmOpen;
  const name = `Section ${index + 1}`;
  const followTime = (key: string) =>
    key === FOLLOW_SONG || sameTime(timeOfKey(key), songTime)
      ? onChange({ ...section, ...songTime, ownTime: false })
      : onChange({ ...section, ...timeOfKey(key), ownTime: true });
  const toggleBpm = () => {
    if (showBpm) {
      setBpmOpen(false);
      if (ownTempo) onChange({ ...section, ownTempo: false, bpm: songBpm });
    } else setBpmOpen(true);
  };
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.backgroundElement }]} testID={`section-${index}`}>
      <View style={styles.cardEdge}>
        <View style={styles.edgeSide}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.cardNumber}>
            {name}
          </ThemedText>
        </View>
        <MoveHandle by={-1} name={name} enabled={index > 0} onMove={onMove} testID={`section-${index}-up`} />
        <View style={[styles.edgeSide, styles.edgeEnd]}>
          <Pressable
            role="switch"
            aria-checked={showBpm}
            aria-label={`Own tempo for ${name}`}
            testID={`section-${index}-bpm-toggle`}
            onPress={toggleBpm}
            hitSlop={8}
            style={({ pressed }) => [styles.addChange, pressed ? styles.addChangePressed : null]}
          >
            <ThemedText themeColor="accent" style={styles.addChangeText}>
              {showBpm ? "Use Song BPM" : "Change BPM"}
            </ThemedText>
          </Pressable>
        </View>
      </View>
      <View style={styles.sectionTop}>
        <View style={styles.headMain}>
          <Dropdown
            look="field"
            label={`Section type of ${name}`}
            testID={`section-${index}-type`}
            options={vocabulary.map((type) => ({ value: type, label: type }))}
            value={section.sectionType}
            onChange={(sectionType) => onChange({ ...section, sectionType })}
            shown={
              <ThemedText style={styles.typeText} numberOfLines={1}>
                {section.sectionType}
              </ThemedText>
            }
          />
          <Dropdown
            look="field"
            label={`Time signature of ${name}`}
            testID={`section-${index}-time`}
            muted={!ownTime}
            menuMinWidth={MENU_MIN_WIDTH}
            options={[{ value: FOLLOW_SONG, label: `Song (${timeSignatureOf(songTime)})` }, ...timeOptions(section)]}
            value={ownTime ? timeSignatureOf(section) : FOLLOW_SONG}
            onChange={followTime}
            shown={
              <ThemedText themeColor={ownTime ? "text" : "textSecondary"} style={styles.typeText} numberOfLines={1}>
                {timeSignatureOf(ownTime ? section : songTime)}
              </ThemedText>
            }
          />
        </View>
        <LabeledField label="No." width={TAG_WIDTH}>
          <NumberStepper
            label={`Number of ${name}`}
            testID={`section-${index}-number`}
            value={section.number}
            range={SECTION_NUMBER_RANGE}
            placeholder="–"
            onChange={(number) => onChange({ ...section, number })}
          />
        </LabeledField>
        <LabeledField label="Sub" width={LETTER_WIDTH}>
          <LetterStepper
            label={`Letter after the number of ${name}`}
            testID={`section-${index}-letter`}
            value={section.number ? section.letter : undefined}
            disabled={!section.number}
            onChange={(letter) => onChange({ ...section, letter: letter as SectionLetter | undefined })}
          />
        </LabeledField>
        <LabeledField label="Bars" width={BARS_WIDTH}>
          <NumberStepper label={`Bars of ${name}`} testID={`section-${index}-bars`} value={section.bars} range={BARS_RANGE} onChange={(bars) => onChange({ ...section, bars: bars ?? section.bars })} />
        </LabeledField>
        <LabeledField label="Plays" width={TAG_WIDTH}>
          <NumberStepper label={`Plays of ${name}`} testID={`section-${index}-plays`} value={plays} range={PLAYS_RANGE} onChange={(next) => onChange(withPlays(section, next ?? plays))} />
        </LabeledField>
      </View>
      {showBpm ? (
        <View style={[styles.changeRow, styles.bpmRow, { backgroundColor: theme.background }]} testID={`section-${index}-bpm-row`}>
          <LabeledField label="BPM" width={BARS_WIDTH}>
            <NumberStepper
              label={`BPM of ${name}`}
              testID={`section-${index}-bpm`}
              value={ownTempo ? section.bpm : undefined}
              range={SECTION_BPM_RANGE}
              placeholder={String(songBpm)}
              stepFrom={songBpm}
              muted
              onChange={(bpm) => onChange(bpm === undefined || bpm === songBpm ? { ...section, ownTempo: false, bpm: songBpm } : { ...section, ownTempo: true, bpm })}
            />
          </LabeledField>
          <ThemedText type="small" themeColor="textSecondary" style={styles.grow}>
            {ownTempo ? `Song is ${songBpm} BPM` : `Follows the Song, ${songBpm} BPM`}
          </ThemedText>
        </View>
      ) : null}
      {changes.map((change, changeIndex) => (
        <TimeChangeRow
          key={changeIndex}
          change={change}
          sectionBars={section.bars}
          testID={`section-${index}-change-${changeIndex}`}
          onChange={(edited) => updateChanges(changes.map((other, otherIndex) => (otherIndex === changeIndex ? edited : other)))}
          onRemove={() => updateChanges(changes.filter((_, otherIndex) => otherIndex !== changeIndex))}
        />
      ))}
      <View style={styles.footer}>
        {addedChange ? (
          <Pressable
            role="button"
            aria-label={`Add a subsection to ${name}`}
            testID={`section-${index}-add-change`}
            onPress={() => updateChanges([...changes, addedChange])}
            style={({ pressed }) => [styles.addChange, pressed ? styles.addChangePressed : null]}
          >
            <Icon name="add" size={16} color="accent" />
            <ThemedText themeColor="accent" style={styles.addChangeText}>
              Subsection
            </ThemedText>
          </Pressable>
        ) : null}
        <View style={styles.voiceCue}>
          <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
            Voice cue
          </ThemedText>
          <Switch bare label={`Voice cue for ${name}`} testID={`section-${index}-voice-cue`} value={section.voiceCueEnabled !== false} onChange={(on) => onChange({ ...section, voiceCueEnabled: on })} />
        </View>
      </View>
      <View style={styles.cardEdge}>
        <IconButton icon="copy" color="textTertiary" size={32} label={`Duplicate ${name}`} onPress={onDuplicate} testID={`section-${index}-duplicate`} />
        <MoveHandle by={1} name={name} enabled={index < count - 1} onMove={onMove} testID={`section-${index}-down`} />
        <IconButton icon="trash" color="textTertiary" size={32} label={`Remove ${name}`} onPress={onRemove} testID={`section-${index}-remove`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Spacing.two, minHeight: 36 },
  voiceCue: { flexDirection: "row", alignItems: "center", gap: Spacing.two, marginLeft: "auto" },
  bpmRow: { alignItems: "center" },
  cardEdge: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  edgeSide: { flex: 1, minWidth: 0 },
  edgeEnd: { alignItems: "flex-end" },
  cardNumber: { fontWeight: 600 },
  fieldLabel: { fontSize: 13, lineHeight: 18, fontWeight: 600 },
  centeredLabel: { textAlign: "center" },
  grow: { flex: 1, minWidth: 0 },
  sectionCard: { gap: Spacing.two, paddingHorizontal: 12, paddingVertical: Spacing.one + 2, borderRadius: Radius.lg },
  sectionTop: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  headMain: { flex: 1, minWidth: 0, gap: Spacing.one },
  typeText: { fontWeight: 600, fontSize: 15, flexShrink: 1, fontVariant: ["tabular-nums"] },
  field: { flex: 1, minWidth: 0, gap: Spacing.one + 2 },
  fixedField: { gap: Spacing.one + 2 },
  fieldBody: { flex: 1, justifyContent: "center" },
  changeRow: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.two, padding: Spacing.two, borderRadius: Radius.md },
  addChange: { flexDirection: "row", alignItems: "center", gap: Spacing.one, minHeight: 36 },
  addChangePressed: { opacity: 0.7 },
  addChangeText: { fontSize: 14, lineHeight: 20, fontWeight: 600 },
  numberField: { flex: 1, minWidth: 0 },
  numberInput: { fontVariant: ["tabular-nums"], paddingHorizontal: 10 },
});
