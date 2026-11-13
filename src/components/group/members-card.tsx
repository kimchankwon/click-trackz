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
import { Dropdown } from "@/components/ui/dropdown";
import { Icon } from "@/components/ui/icon";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { assignableRoles, canManageGroup, canSteerPlayback, guestCanHold, outranks, ROLE_NAMES, type Role } from "@/lib/roles";
import { timeAgo } from "@/lib/time-ago";
import { lastSeenOf, memberPresence, otherMemberPing, type MemberPresence, type PresenceRow } from "@/presence/online";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type MemberAction =
  | { kind: "remove"; userId: Id<"users">; name: string }
  | { kind: "role"; userId: Id<"users">; name: string; role: Role };

const ROLE_POWERS: Record<Role, string> = {
  admin: "do everything, including deleting the Group",
  groupManager: "edit Songs and Setlists, run Playback, rename the Group and its Members, and make Song and Playback Managers",
  songManager: "edit Songs and Setlists and run Playback",
  playbackManager: "start, steer and stop Playback",
  member: "see the Songs and Setlists and follow Playback",
};

const withArticle = (role: Role) => `${/^[AEIOU]/.test(ROLE_NAMES[role]) ? "an" : "a"} ${ROLE_NAMES[role]}`;

function dialogFor(action: MemberAction | null, groupName: string) {
  if (action?.kind === "role") {
    return {
      title: `Make ${action.name} ${withArticle(action.role)}?`,
      message: `In ${groupName}, ${action.name} will be able to ${ROLE_POWERS[action.role]}.`,
      confirmLabel: `Make ${ROLE_NAMES[action.role]}`,
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
  role: myRole,
  presence,
}: {
  groupId: Id<"groups">;
  groupName: string;
  role: Role;
  presence: { rows: readonly PresenceRow[]; nowMs: number };
}) {
  const members = useQuery(api.groups.members, { groupId });
  const viewer = useQuery(api.users.viewer, {});
  const setRole = useMutation(api.groups.setRole);
  const removeMember = useMutation(api.groups.removeMember);
  const setDisplayName = useMutation(api.groups.setDisplayName);
  const setMemberName = useMutation(api.groups.setMemberName);
  const [nameEdit, setNameEdit] = useState<{ userId: Id<"users">; draft: string } | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const managing = canManageGroup(myRole);
  const roleChoices = assignableRoles(myRole);
  const saveName = async () => {
    if (nameEdit === null || nameSaving) return;
    setNameError(null);
    setNameSaving(true);
    try {
      if (nameEdit.userId === viewer?.id) await setDisplayName({ groupId, displayName: nameEdit.draft });
      else await setMemberName({ groupId, userId: nameEdit.userId, displayName: nameEdit.draft });
      setNameEdit(null);
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
        const roleName = !member.isGuest ? ROLE_NAMES[member.role] : member.role === "member" ? "Guest" : `Guest · ${ROLE_NAMES[member.role]}`;
        const isYou = member.userId === viewer?.id;
        const canChange = managing && !isYou && outranks(myRole, member.role);
        const editingName = nameEdit !== null && nameEdit.userId === member.userId;
        const status = statusOf(member.userId);
        const pingMs =
          canSteerPlayback(myRole) && status !== "offline" ? otherMemberPing(presence.rows, member.userId, viewer?.id, presence.nowMs) : null;
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
                  <Icon name={member.role === "member" ? "member" : "admin"} size={16} color="textSecondary" />
                  <ThemedText type="small" themeColor="textSecondary">
                    {roleName}
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
            {isYou && !editingName ? (
              <View style={styles.actions}>
                <ActionButton
                  tiny
                  variant="pill"
                  icon="edit"
                  label="Change your name"
                  testID="change-name"
                  onPress={() => {
                    setNameError(null);
                    setNameEdit({ userId: member.userId, draft: member.displayName });
                  }}
                />
              </View>
            ) : null}
            {editingName ? (
              <View style={styles.nameEditor}>
                <Field
                  label={isYou ? "Your name in this Group" : `${member.displayName}'s name in this Group`}
                  testID={isYou ? "my-name-input" : `name-input-${member.displayName}`}
                  value={nameEdit.draft}
                  onChangeText={(draft) => setNameEdit({ userId: member.userId, draft })}
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
                  <ActionButton small label="Cancel" testID="my-name-cancel" disabled={nameSaving} onPress={() => setNameEdit(null)} />
                  <ActionButton
                    small
                    accent
                    label={nameSaving ? "Saving…" : "Save name"}
                    accessibleName="Save name"
                    testID="my-name-save"
                    pending={nameSaving}
                    disabled={nameEdit.draft.trim().length === 0}
                    onPress={() => void saveName()}
                  />
                </View>
              </View>
            ) : null}
            {canChange && !editingName ? (
              <View style={styles.actions}>
                <View style={styles.roleDropdown}>
                  <Dropdown
                    label={`${member.displayName}'s Role`}
                    testID={`role-${member.displayName}`}
                    value={member.role}
                    options={roleChoices
                      .filter((choice) => choice === member.role || !member.isGuest || guestCanHold(choice))
                      .map((choice) => ({ value: choice, label: ROLE_NAMES[choice] }))}
                    onChange={(choice) => ask({ kind: "role", userId: member.userId, name: member.displayName, role: choice })}
                  />
                </View>
                <ActionButton
                  tiny
                  variant="pill"
                  icon="edit"
                  label="Rename"
                  accessibleName={`Rename ${member.displayName}`}
                  testID={`rename-${member.displayName}`}
                  onPress={() => {
                    setNameError(null);
                    setNameEdit({ userId: member.userId, draft: member.displayName });
                  }}
                />
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
  roleDropdown: { flexBasis: "100%" },
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
