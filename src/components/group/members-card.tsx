import { useMutation, useQuery } from "convex/react";
import { StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { Card } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function MembersCard({ groupId, isAdmin, run }: { groupId: Id<"groups">; isAdmin: boolean; run: (action: () => Promise<unknown>) => void }) {
  const members = useQuery(api.groups.members, { groupId });
  const viewer = useQuery(api.users.viewer, {});
  const setRole = useMutation(api.groups.setRole);
  const theme = useTheme();
  const list = members ?? [];
  return (
    <Card title={`Members · ${list.length}`}>
      {list.map((member) => {
        const role = member.role === "admin" ? "Admin" : member.isGuest ? "Guest" : "Member";
        return (
          <View key={member.userId} style={styles.row} testID={`member-${member.displayName}`}>
            <View style={[styles.avatar, { backgroundColor: member.role === "admin" ? theme.accentTint : theme.backgroundSelected }]}>
              <ThemedText type="smallBold" themeColor={member.role === "admin" ? "accent" : "textSecondary"}>
                {member.displayName.slice(0, 1).toUpperCase()}
              </ThemedText>
            </View>
            <View style={styles.name}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {member.displayName}
                {member.userId === viewer?.id ? " (you)" : ""}
              </ThemedText>
              <ThemedText type="caption" themeColor={member.role === "admin" ? "accent" : "textSecondary"}>
                {role}
              </ThemedText>
            </View>
            {isAdmin && !member.isGuest ? (
              <ActionButton
                small
                variant="ghost"
                label={member.role === "admin" ? "Make Member" : "Make Admin"}
                testID={`toggle-admin-${member.displayName}`}
                onPress={() =>
                  run(() => setRole({ groupId, userId: member.userId, role: member.role === "admin" ? "member" : "admin" }))
                }
              />
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 52 },
  avatar: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  name: { flex: 1, minWidth: 0 },
});
