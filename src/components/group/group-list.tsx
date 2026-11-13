import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { primeAudio } from "@/audio/primed-context";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type ListedGroup = { groupId: string; name: string; locked: boolean };

export function GroupList({ groups, onlineIn, testID }: { groups: readonly ListedGroup[]; onlineIn: (groupId: string) => number | null; testID: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.list, { backgroundColor: theme.backgroundElement }]} testID={testID}>
      {groups.map((group, index) => {
        const online = onlineIn(group.groupId);
        return (
          <Pressable
            key={group.groupId}
            role="link"
            testID={`open-group-${group.name}`}
            onPress={() => {
              primeAudio();
              router.push({ pathname: "/group/[groupId]", params: { groupId: group.groupId } });
            }}
            style={({ pressed }) => [styles.groupRow, pressed ? { backgroundColor: theme.backgroundSelected } : null]}
          >
            {index > 0 ? <View style={[styles.separator, { backgroundColor: theme.border }]} /> : null}
            <Avatar name={group.name} position={index} />
            <View style={styles.grow}>
              <ThemedText type="default" style={styles.groupName} numberOfLines={1}>
                {group.name}
              </ThemedText>
              <View style={styles.roleRow} testID={`online-${group.name}`}>
                {group.locked ? (
                  <>
                    <Icon name="warning" size={14} color="textSecondary" />
                    <ThemedText themeColor="textSecondary" style={styles.role} testID={`locked-${group.name}`}>
                      Locked
                    </ThemedText>
                  </>
                ) : (
                  <>
                    <View style={[styles.onlineDot, { backgroundColor: online !== null && online > 0 ? theme.switchOn : theme.dotInactive }]} />
                    <ThemedText themeColor="textSecondary" style={styles.role}>
                      {online === null ? "Not connected" : online > 0 ? `${online} online` : "No one online"}
                    </ThemedText>
                  </>
                )}
              </View>
            </View>
            <Icon name="forward" size={22} color="textTertiary" />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: Radius.lg, overflow: "hidden" },
  grow: { flex: 1, minWidth: 0 },
  groupRow: { flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 68, paddingHorizontal: Spacing.three },
  groupName: { fontWeight: 600, fontSize: 17 },
  role: { fontSize: 15, lineHeight: 20, fontWeight: 400 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  roleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  separator: { position: "absolute", top: 0, left: 72, right: Spacing.three, height: StyleSheet.hairlineWidth },
});
