import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/avatar";
import { SignalBars } from "@/components/ui/signal-bars";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { placeMenu, type Anchor } from "@/lib/menu-placement";

export type OnlineMember = {
  userId: string;
  name: string;
  position: number;
  roleName: string;
  onPlay: boolean;
  pingMs: number | null;
  isYou?: boolean;
  started?: boolean;
};

export type OnlineListAnchor = Anchor & { focus?: string };

const ROW_HEIGHT = 60;
const HEADER_HEIGHT = 44;
const NOTE_HEIGHT = 40;
const MENU_WIDTH = 300;
const MAX_HEIGHT = 420;

export function OnlineMembers({ anchor, members, onClose }: { anchor: OnlineListAnchor | null; members: readonly OnlineMember[]; onClose: () => void }) {
  const theme = useTheme();
  const screen = useWindowDimensions();
  const alone = members.length > 0 && members.every((member) => member.isYou);
  const note = members.length === 0 ? "No one is online right now." : alone ? "No one else is online right now." : null;
  const wanted = HEADER_HEIGHT + members.length * ROW_HEIGHT + (note ? NOTE_HEIGHT : 0) + Spacing.two;
  const place = anchor ? placeMenu(anchor, screen, { height: Math.min(MAX_HEIGHT, wanted), minWidth: MENU_WIDTH }) : null;
  return (
    <Modal visible={anchor !== null} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable aria-label="Close the online list" style={StyleSheet.absoluteFill} onPress={onClose} testID="online-list-outside" />
      {place ? (
        <View
          role="dialog"
          aria-label={`${members.length} online`}
          testID="online-list"
          style={[
            styles.menu,
            { left: place.left, top: place.top, width: place.width, maxHeight: place.height, borderColor: theme.border, backgroundColor: theme.backgroundElement, shadowColor: theme.text },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <ThemedText type="label" themeColor="textSecondary" role="heading">
              Online now
            </ThemedText>
            <ThemedText type="smallBold" themeColor="textSecondary" testID="online-list-count">
              {members.length}
            </ThemedText>
          </View>
          <ScrollView>
            {members.map((member, index) => (
              <View
                key={member.userId}
                testID={`online-${member.name}`}
                style={[
                  styles.row,
                  index > 0 ? { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth } : null,
                  anchor?.focus === member.userId ? { backgroundColor: theme.backgroundSelected } : null,
                ]}
              >
                <View>
                  <Avatar
                    name={member.name}
                    size={36}
                    position={member.position}
                    colors={member.started ? { background: theme.accent, text: theme.onAccent } : undefined}
                  />
                  <View style={[styles.dot, { borderColor: theme.backgroundElement, backgroundColor: theme.switchOn }]} />
                </View>
                <View style={styles.text}>
                  <ThemedText numberOfLines={1} style={styles.name}>
                    {member.name}
                    {member.isYou ? " (you)" : ""}
                  </ThemedText>
                  <View style={styles.facts}>
                    <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} testID={`online-${member.name}-role`}>
                      {member.roleName}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="success" numberOfLines={1}>
                      {member.onPlay ? "On Play" : "Online"}
                    </ThemedText>
                    {member.started ? (
                      <ThemedText type="caption" themeColor="accent" numberOfLines={1}>
                        Started Playback
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
                {member.pingMs !== null ? (
                  <View style={styles.ping} aria-label={`${Math.round(member.pingMs)} ms ping`}>
                    <SignalBars roundTripMs={member.pingMs} size={11} />
                    <ThemedText type="caption" themeColor="textSecondary" style={styles.pingText}>
                      {Math.round(member.pingMs)} ms
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ))}
            {note ? (
              <ThemedText type="small" themeColor="textSecondary" testID="online-list-empty" style={styles.note}>
                {note}
              </ThemedText>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: "hidden",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: HEADER_HEIGHT,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: ROW_HEIGHT, paddingHorizontal: Spacing.three },
  dot: { position: "absolute", right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, lineHeight: 22, fontWeight: 600 },
  facts: { flexDirection: "row", alignItems: "center", gap: Spacing.two, flexWrap: "wrap" },
  ping: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  pingText: { fontVariant: ["tabular-nums"] },
  note: { minHeight: NOTE_HEIGHT, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});
