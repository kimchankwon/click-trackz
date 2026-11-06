import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/ui/icon";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type GroupTab = "play" | "songs" | "sound" | "group";

export const tabId = (tab: GroupTab) => `group-tab-${tab}`;
export const panelId = (tab: GroupTab) => `group-panel-${tab}`;

const tabs: { id: GroupTab; label: string; icon: IconName }[] = [
  { id: "play", label: "Play", icon: "playCircle" },
  { id: "songs", label: "Songs", icon: "songs" },
  { id: "sound", label: "Sound", icon: "sound" },
  { id: "group", label: "Group", icon: "group" },
];

export function TabBar({ active, onChange }: { active: GroupTab; onChange: (tab: GroupTab) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.bar} role="tablist">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            role="tab"
            id={tabId(tab.id)}
            aria-selected={selected}
            aria-controls={panelId(tab.id)}
            testID={`tab-${tab.id}`}
            onPress={() => onChange(tab.id)}
            style={styles.tab}
          >
            <View style={[styles.iconWrap, selected ? { backgroundColor: theme.accentTint } : null]}>
              <Icon name={tab.icon} size={22} color={selected ? "accent" : "textSecondary"} />
            </View>
            <ThemedText type="caption" themeColor={selected ? "accent" : "textSecondary"} style={styles.label}>
              {tab.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", paddingTop: Spacing.two, paddingBottom: Spacing.one },
  tab: { flex: 1, alignItems: "center", gap: 2, minHeight: 52 },
  iconWrap: { width: 56, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  label: { fontWeight: 700, fontSize: 12, lineHeight: 16 },
});
