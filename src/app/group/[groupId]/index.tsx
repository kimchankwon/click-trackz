import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useStoredLibrary } from "@/library/use-my-library";
import { storedLibraryGroup } from "@/library/snapshot";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Connecting } from "@/components/ui/connecting";
import { GroupScreen } from "@/components/group/group-screen";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { api } from "../../../../convex/_generated/api";

export default function GroupRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const myGroups = useQuery(api.groups.myGroups, {});
  const storedLibrary = useStoredLibrary();
  const theme = useTheme();
  if (myGroups === undefined) {
    if (storedLibrary && storedLibrary.groupId === groupId) return <GroupScreen group={storedLibraryGroup(storedLibrary)} groupNames={[]} storedLibrary={storedLibrary} />;
    return (
      <ThemedView style={[styles.container, styles.loading]}>
        <Connecting />
        <Pressable role="button" testID="back-to-groups" onPress={() => router.dismissTo("/")} style={styles.loadingBack}>
          <ThemedText type="small" themeColor="accent">
            Back to your Groups
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }
  const group = myGroups.find((g) => g.groupId === groupId);
  if (group) {
    const stored = group.offline && storedLibrary?.groupId === group.groupId ? storedLibrary : null;
    return <GroupScreen group={group} groupNames={myGroups.map((mine) => mine.name)} storedLibrary={stored} />;
  }
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.notInGroup}>
        <ThemedText type="subtitle">You are not in this Group</ThemedText>
        <ThemedText themeColor="textSecondary" testID="not-in-group">
          Ask its Admin or a Group Manager for the join code, or open one of your Groups.
        </ThemedText>
        <Pressable
          role="button"
          testID="back-to-groups"
          onPress={() => router.dismissTo("/")}
          style={[styles.backButton, { backgroundColor: theme.accent }]}
        >
          <ThemedText style={{ color: theme.onAccent }}>Back to your Groups</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { justifyContent: "center", alignItems: "center" },
  loadingBack: { marginTop: Spacing.four, padding: Spacing.two },
  notInGroup: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.three, padding: Spacing.four },
  backButton: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: Radius.md },
});
