import { useMutation, useQuery } from "convex/react";
import { View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { Card } from "@/components/group/card";
import { rowStyles } from "@/components/group/row-styles";
import { ThemedText } from "@/components/themed-text";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function MembersCard({ groupId, isAdmin, run }: { groupId: Id<"groups">; isAdmin: boolean; run: (action: () => Promise<unknown>) => void }) {
  const members = useQuery(api.groups.members, { groupId });
  const viewer = useQuery(api.users.viewer, {});
  const setRole = useMutation(api.groups.setRole);
  return (
    <Card title="MEMBERS">
      {(members ?? []).map((member) => (
        <View key={member.userId} style={rowStyles.row} testID={`member-${member.displayName}`}>
          <ThemedText style={rowStyles.name}>
            {member.displayName}
            {member.userId === viewer?.id ? " (you)" : ""}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {member.role === "admin" ? "Admin" : member.isGuest ? "Guest" : "Member"}
          </ThemedText>
          {isAdmin && !member.isGuest ? (
            <ActionButton
              small
              label={member.role === "admin" ? "Make Member" : "Make Admin"}
              testID={`toggle-admin-${member.displayName}`}
              onPress={() =>
                run(() => setRole({ groupId, userId: member.userId, role: member.role === "admin" ? "member" : "admin" }))
              }
            />
          ) : null}
        </View>
      ))}
    </Card>
  );
}
