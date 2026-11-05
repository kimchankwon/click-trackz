import { useMutation, useQuery } from "convex/react";
import { Pressable, StyleSheet, View } from "react-native";

import { Card } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function MembersCard({ groupId, isAdmin, run }: { groupId: Id<"groups">; isAdmin: boolean; run: (action: () => Promise<unknown>) => void }) {
  const members = useQuery(api.groups.members, { groupId });
  const viewer = useQuery(api.users.viewer, {});
  const setRole = useMutation(api.groups.setRole);
  const theme = useTheme();
  return (
    <Card title="MEMBERS">
      {(members ?? []).map((member) => (
        <View key={member.userId} style={styles.memberRow} testID={`member-${member.displayName}`}>
          <ThemedText style={styles.memberName}>
            {member.displayName}
            {member.userId === viewer?.id ? " (you)" : ""}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {member.role === "admin" ? "Admin" : member.isGuest ? "Guest" : "Member"}
          </ThemedText>
          {isAdmin && !member.isGuest ? (
            <Pressable
              role="button"
              testID={`toggle-admin-${member.displayName}`}
              onPress={() =>
                run(() => setRole({ groupId, userId: member.userId, role: member.role === "admin" ? "member" : "admin" }))
              }
              style={[styles.smallButton, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="small">{member.role === "admin" ? "Make Member" : "Make Admin"}</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  memberRow: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  memberName: { flex: 1 },
  smallButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.three },
});
