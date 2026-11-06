import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { Card } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconButton } from "@/components/ui/icon-button";
import { SignalBars } from "@/components/ui/signal-bars";
import { Icon } from "@/components/ui/icon";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { memberPing, memberPresence, type MemberPresence, type PresenceRow } from "@/presence/online";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const presenceText: Record<MemberPresence, string> = { onPlay: "On Play", online: "Online", offline: "Offline" };

export function MembersCard({
  groupId,
  groupName,
  isAdmin,
  run,
  presence,
}: {
  groupId: Id<"groups">;
  groupName: string;
  isAdmin: boolean;
  run: (action: () => Promise<unknown>) => void;
  presence: { rows: readonly PresenceRow[]; nowMs: number };
}) {
  const members = useQuery(api.groups.members, { groupId });
  const viewer = useQuery(api.users.viewer, {});
  const setRole = useMutation(api.groups.setRole);
  const removeMember = useMutation(api.groups.removeMember);
  const [removing, setRemoving] = useState<{ userId: Id<"users">; name: string } | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const confirmRemove = () =>
    run(async () => {
      if (!removing) return;
      setRemovePending(true);
      try {
        await removeMember({ groupId, userId: removing.userId });
        setRemoving(null);
      } finally {
        setRemovePending(false);
      }
    });
  const theme = useTheme();
  const list = members ?? [];
  const statusOf = (userId: string) => memberPresence(presence.rows, userId, presence.nowMs, viewer?.id);
  const onlineCount = list.filter((member) => statusOf(member.userId) !== "offline").length;
  return (
    <Card title={`Members · ${list.length} · ${onlineCount} online`}>
      {list.map((member, index) => {
        const role = member.role === "admin" ? "Admin" : member.isGuest ? "Guest" : "Member";
        const status = statusOf(member.userId);
        const pingMs = isAdmin && status !== "offline" ? memberPing(presence.rows, member.userId, presence.nowMs) : null;
        return (
          <View key={member.userId} style={styles.row} testID={`member-${member.displayName}`}>
            {index > 0 ? <View style={[styles.separator, { backgroundColor: theme.border }]} /> : null}
            <View>
              <Avatar name={member.displayName} position={index} />
              <View
                testID={`presence-${member.displayName}`}
                aria-label={presenceText[status]}
                style={[
                  styles.presenceDot,
                  { borderColor: theme.backgroundElement, backgroundColor: status === "offline" ? theme.dotInactive : theme.switchOn },
                ]}
              />
            </View>
            <View style={styles.name}>
              <ThemedText numberOfLines={1} style={styles.memberName}>
                {member.displayName}
                {member.userId === viewer?.id ? " (you)" : ""}
              </ThemedText>
              <View style={styles.roleRow}>
                <Icon name={member.role === "admin" ? "admin" : "member"} size={16} color="textSecondary" />
                <ThemedText type="small" themeColor="textSecondary">
                  {role} ·{" "}
                </ThemedText>
                <ThemedText type="small" themeColor={status === "offline" ? "textTertiary" : "success"}>
                  {presenceText[status]}
                </ThemedText>
                {pingMs !== null ? (
                  <View style={styles.ping}>
                    <SignalBars roundTripMs={pingMs} size={11} testID={`ping-${member.displayName}`} />
                    <ThemedText type="small" themeColor="textSecondary" style={styles.pingText}>
                      {Math.round(pingMs)} ms
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
            {isAdmin && !member.isGuest && member.userId !== viewer?.id ? (
              <ActionButton
                tiny
                variant="pill"
                label={member.role === "admin" ? "Make Member" : "Make Admin"}
                testID={`toggle-admin-${member.displayName}`}
                onPress={() =>
                  run(() => setRole({ groupId, userId: member.userId, role: member.role === "admin" ? "member" : "admin" }))
                }
              />
            ) : null}
            {isAdmin && member.userId !== viewer?.id ? (
              <IconButton
                icon="trash"
                color="textTertiary"
                size={36}
                label={`Remove ${member.displayName} from the Group`}
                testID={`remove-${member.displayName}`}
                onPress={() => setRemoving({ userId: member.userId, name: member.displayName })}
              />
            ) : null}
          </View>
        );
      })}
      <ConfirmDialog
        visible={removing !== null}
        title={`Remove ${removing?.name ?? ""}?`}
        message={`${removing?.name ?? "They"} will be taken out of ${groupName} straight away. They can rejoin with the join code.`}
        confirmLabel="Remove"
        pending={removePending}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
        testID="remove-member-dialog"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 60 },
  separator: { position: "absolute", top: -Spacing.two, left: 56, right: 0, height: StyleSheet.hairlineWidth },
  name: { flex: 1, minWidth: 0 },
  roleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  presenceDot: { position: "absolute", right: -1, bottom: -1, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  ping: { flexDirection: "row", alignItems: "center", gap: Spacing.one, marginLeft: Spacing.two },
  pingText: { fontVariant: ["tabular-nums"] },
  memberName: { fontSize: 17, lineHeight: 22, fontWeight: 600 },
});
