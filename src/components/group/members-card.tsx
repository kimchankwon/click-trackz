import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { Card } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { SignalBars } from "@/components/ui/signal-bars";
import { Icon } from "@/components/ui/icon";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { timeAgo } from "@/lib/time-ago";
import { lastSeenOf, memberPresence, otherMemberPing, type MemberPresence, type PresenceRow } from "@/presence/online";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type MemberAction =
  | { kind: "remove"; userId: Id<"users">; name: string }
  | { kind: "role"; userId: Id<"users">; name: string; role: "admin" | "member" };

function dialogFor(action: MemberAction | null, groupName: string) {
  if (action?.kind === "role" && action.role === "admin") {
    return {
      title: `Make ${action.name} an Admin?`,
      message: `${action.name} will be able to edit Songs and Setlists, start and stop Playback, and manage Members of ${groupName}.`,
      confirmLabel: "Make Admin",
      testID: "role-dialog",
    };
  }
  if (action?.kind === "role") {
    return {
      title: `Make ${action.name} a Member?`,
      message: `${action.name} will no longer be able to edit Songs and Setlists, run Playback or manage Members.`,
      confirmLabel: "Make Member",
      testID: "role-dialog",
    };
  }
  return {
    title: `Remove ${action?.name ?? ""}?`,
    message: `${action?.name ?? "They"} will be taken out of ${groupName} straight away. They can rejoin with the join code.`,
    confirmLabel: "Remove",
    testID: "remove-member-dialog",
  };
}

const presenceText: Record<MemberPresence, string> = { onPlay: "On Play", online: "Online", offline: "Offline" };

export function MembersCard({
  groupId,
  groupName,
  isAdmin,
  presence,
}: {
  groupId: Id<"groups">;
  groupName: string;
  isAdmin: boolean;
  presence: { rows: readonly PresenceRow[]; nowMs: number };
}) {
  const members = useQuery(api.groups.members, { groupId });
  const viewer = useQuery(api.users.viewer, {});
  const setRole = useMutation(api.groups.setRole);
  const removeMember = useMutation(api.groups.removeMember);
  const setDisplayName = useMutation(api.groups.setDisplayName);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const saveName = async () => {
    if (nameDraft === null || nameSaving) return;
    setNameError(null);
    setNameSaving(true);
    try {
      await setDisplayName({ groupId, displayName: nameDraft });
      setNameDraft(null);
    } catch (error) {
      setNameError(errorText(error));
    } finally {
      setNameSaving(false);
    }
  };
  const [action, setAction] = useState<MemberAction | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const ask = (next: MemberAction) => {
    setActionError(null);
    setAction(next);
  };
  const confirmAction = async () => {
    const target = action;
    if (!target || actionPending) return;
    setActionError(null);
    setActionPending(true);
    try {
      if (target.kind === "remove") await removeMember({ groupId, userId: target.userId });
      else await setRole({ groupId, userId: target.userId, role: target.role });
      setAction((current) => (current === target ? null : current));
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      setActionPending(false);
    }
  };
  const dialog = dialogFor(action, groupName);
  const theme = useTheme();
  const list = members ?? [];
  const statusOf = (userId: string) => memberPresence(presence.rows, userId, presence.nowMs, viewer?.id);
  const onlineCount = list.filter((member) => statusOf(member.userId) !== "offline").length;
  const offlineText = (lastSeen: number | null) => (lastSeen === null ? "Offline" : `Last online ${timeAgo(Math.max(0, presence.nowMs - lastSeen))}`);
  return (
    <Card title={`Members (${list.length}, ${onlineCount} online)`}>
      {list.map((member, index) => {
        const role = member.role === "admin" ? "Admin" : member.isGuest ? "Guest" : "Member";
        const status = statusOf(member.userId);
        const pingMs =
          isAdmin && status !== "offline" ? otherMemberPing(presence.rows, member.userId, viewer?.id, presence.nowMs) : null;
        return (
          <View key={member.userId} style={styles.item} testID={`member-${member.displayName}`}>
            {index > 0 ? <View style={[styles.separator, { backgroundColor: theme.border }]} /> : null}
            <View style={styles.row}>
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
                    {role}
                  </ThemedText>
                  <ThemedText type="small" themeColor={status === "offline" ? "textTertiary" : "success"} testID={`status-${member.displayName}`} style={styles.status}>
                    {status === "offline" ? offlineText(lastSeenOf(presence.rows, member.userId, member.lastSeenAt)) : presenceText[status]}
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
            </View>
            {member.userId === viewer?.id && nameDraft === null ? (
              <View style={styles.actions}>
                <ActionButton
                  tiny
                  variant="pill"
                  icon="edit"
                  label="Change your name"
                  testID="change-name"
                  onPress={() => {
                    setNameError(null);
                    setNameDraft(member.displayName);
                  }}
                />
              </View>
            ) : null}
            {member.userId === viewer?.id && nameDraft !== null ? (
              <View style={styles.nameEditor}>
                <Field
                  label="Your name in this Group"
                  testID="my-name-input"
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  autoCapitalize="words"
                  autoFocus
                  inset
                  onSubmitEditing={() => void saveName()}
                />
                {nameError ? (
                  <ThemedText type="caption" themeColor="danger" testID="my-name-error">
                    {nameError}
                  </ThemedText>
                ) : null}
                <View style={styles.nameButtons}>
                  <ActionButton small label="Cancel" testID="my-name-cancel" disabled={nameSaving} onPress={() => setNameDraft(null)} />
                  <ActionButton
                    small
                    accent
                    label={nameSaving ? "Saving…" : "Save name"}
                    accessibleName="Save name"
                    testID="my-name-save"
                    pending={nameSaving}
                    disabled={nameDraft.trim().length === 0}
                    onPress={() => void saveName()}
                  />
                </View>
              </View>
            ) : null}
            {isAdmin && member.userId !== viewer?.id ? (
              <View style={styles.actions}>
                {!member.isGuest ? (
                  <ActionButton
                    tiny
                    variant="pill"
                    label={member.role === "admin" ? "Make Member" : "Make Admin"}
                    testID={`toggle-admin-${member.displayName}`}
                    onPress={() =>
                      ask({ kind: "role", userId: member.userId, name: member.displayName, role: member.role === "admin" ? "member" : "admin" })
                    }
                  />
                ) : null}
                <ActionButton
                  tiny
                  variant="pill"
                  icon="trash"
                  label="Remove"
                  accessibleName={`Remove ${member.displayName} from the Group`}
                  testID={`remove-${member.displayName}`}
                  onPress={() => ask({ kind: "remove", userId: member.userId, name: member.displayName })}
                />
              </View>
            ) : null}
          </View>
        );
      })}
      <ConfirmDialog
        visible={action !== null}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.confirmLabel}
        pending={actionPending}
        error={actionError}
        onConfirm={() => void confirmAction()}
        onCancel={() => setAction(null)}
        testID={dialog.testID}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { gap: Spacing.two },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 60 },
  nameEditor: { gap: Spacing.two, paddingLeft: 40 + Spacing.three },
  nameButtons: { flexDirection: "row", justifyContent: "flex-end", gap: Spacing.two },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, paddingLeft: 40 + Spacing.three },
  separator: { position: "absolute", top: -Spacing.two, left: 56, right: 0, height: StyleSheet.hairlineWidth },
  name: { flex: 1, minWidth: 0 },
  roleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Spacing.one },
  status: { marginLeft: Spacing.two },
  presenceDot: { position: "absolute", right: -1, bottom: -1, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  ping: { flexDirection: "row", alignItems: "center", gap: Spacing.one, marginLeft: Spacing.two },
  pingText: { fontVariant: ["tabular-nums"] },
  memberName: { fontSize: 17, lineHeight: 22, fontWeight: 600 },
});
