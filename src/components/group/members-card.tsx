import { useMutation, useQuery } from "convex/react";
import { StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { Card } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Spacing } from "@/constants/theme";
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
      {list.map((member, index) => {
        const role = member.role === "admin" ? "Admin" : member.isGuest ? "Guest" : "Member";
        return (
          <View key={member.userId} style={styles.row} testID={`member-${member.displayName}`}>
            {index > 0 ? <View style={[styles.separator, { backgroundColor: theme.border }]} /> : null}
            <Avatar name={member.displayName} />
            <View style={styles.name}>
              <ThemedText numberOfLines={1} style={styles.memberName}>
                {member.displayName}
                {member.userId === viewer?.id ? " (you)" : ""}
              </ThemedText>
              <View style={styles.roleRow}>
                <Icon name={member.role === "admin" ? "admin" : "member"} size={16} color="textSecondary" />
                <ThemedText type="small" themeColor="textSecondary">
                  {role}
                </ThemedText>
              </View>
            </View>
            {isAdmin && !member.isGuest ? (
              <ActionButton
                small
                variant="quiet"
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
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 60 },
  separator: { position: "absolute", top: -Spacing.two, left: 56, right: 0, height: StyleSheet.hairlineWidth },
  name: { flex: 1, minWidth: 0 },
  roleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  memberName: { fontSize: 17, lineHeight: 22, fontWeight: 600 },
});
