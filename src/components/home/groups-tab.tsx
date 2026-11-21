import { useMutation, useQuery } from "convex/react";
import { router, useIsFocused } from "expo-router";
import { useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";

import { useGoogleSignIn } from "@/auth/use-google-sign-in";
import { AboutLink } from "@/components/home/about-link";
import type { Run } from "@/components/home/run";
import { ActionButton } from "@/components/action-button";
import { primeAudio } from "@/audio/primed-context";
import { Card } from "@/components/group/card";
import { GroupList } from "@/components/group/group-list";
import { ThemedText } from "@/components/themed-text";
import { Field } from "@/components/ui/field";
import { GoogleMark } from "@/components/ui/google-mark";
import { ConnectionBadge } from "@/components/ui/connection-badge";
import { Spacing } from "@/constants/theme";
import { clearPendingJoin, readPendingJoin } from "@/lib/pending-join";
import { useConnected } from "@/lib/use-connected";
import { useServerNow } from "@/lib/use-server-now";
import { useRoundTrip } from "@/sync/use-round-trip";
import { canCreateGroup, canCreateGroupBeforeLaunch, LAUNCH_LIMITS, PLAN_NAMES } from "@/lib/plans";
import { useKeepHomeOnDevice, useStoredHome } from "@/home/use-stored-home";
import { useStoredLibrary } from "@/library/use-my-library";
import { onlineCount } from "@/presence/online";
import { api } from "../../../convex/_generated/api";

const ONLINE_REFRESH_MS = 15_000;

export function GroupsTab({ run, active }: { run: Run; active: boolean }) {
  const viewer = useQuery(api.users.viewer, {});
  const liveGroups = useQuery(api.groups.myGroups, viewer === null ? "skip" : {});
  const storedHome = useStoredHome();
  useKeepHomeOnDevice(liveGroups, viewer?.isAnonymous);
  const allGroups = liveGroups ?? storedHome?.groups;
  const groups = allGroups?.filter((group) => !group.offline);
  const ownedGroups = (groups ?? []).filter((group) => group.owned);
  const joinedGroups = (groups ?? []).filter((group) => !group.owned);
  const openOffline = useMutation(api.groups.openOffline);
  const storedLibrary = useStoredLibrary();
  const createGroup = useMutation(api.groups.createGroup);
  const joinGroup = useMutation(api.groups.joinGroup);
  const signInWithGoogle = useGoogleSignIn();
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState(() => readPendingJoin() ?? "");
  const [groupName, setGroupName] = useState("");
  const isGuest = viewer?.isAnonymous ?? storedHome?.isAnonymous ?? true;
  const usage = useQuery(api.subscriptions.mine, viewer ? {} : "skip");
  const seen = useQuery(api.presence.myGroupsSeen, {});
  const connected = useConnected();
  const nowMs = useServerNow(seen?.serverNow, ONLINE_REFRESH_MS);
  const focused = useIsFocused();
  const roundTripMs = useRoundTrip(active && focused && connected);
  const onlineIn = (groupId: string) =>
    connected && seen !== undefined ? onlineCount(seen.groups.find((entry) => entry.groupId === groupId)?.seenAt ?? [], nowMs) : null;

  return (
    <>
      <View style={styles.titleRow}>
        <ThemedText type="title" role="heading">
          Groups
        </ThemedText>
        <ConnectionBadge roundTripMs={roundTripMs} />
      </View>

      {joinedGroups.length > 0 ? <GroupList groups={joinedGroups} onlineIn={onlineIn} testID="joined-groups" /> : null}
      {ownedGroups.length > 0 ? (
        <Card title="Your Groups" plain>
          <GroupList groups={ownedGroups} onlineIn={onlineIn} testID="your-groups" />
        </Card>
      ) : null}

      <Card title="My Library">
        <ThemedText type="caption" themeColor="textSecondary">
          {`Plays offline, just for you.${usage?.enforced ? " Free holds 10 Songs; Plus and Pro hold 1000." : ""}`}
        </ThemedText>
        <ActionButton
          variant="outline"
          icon="library"
          label="Open My Library"
          testID="open-offline"
          onPress={() => {
            primeAudio();
            if (!connected && storedLibrary) {
              router.push({ pathname: "/group/[groupId]", params: { groupId: storedLibrary.groupId } });
              return;
            }
            run(async () => {
              const groupId = await openOffline({});
              router.push({ pathname: "/group/[groupId]", params: { groupId } });
            });
          }}
        />
      </Card>

      <Card title="Join a Group">
        <Field
          label="Your name in the Group"
          testID="display-name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="e.g. Jisue"
          autoCapitalize="words"
          inset
        />
        <View style={styles.inline}>
          <Field
            label="Join code"
            testID="join-code-input"
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="6 letters"
            autoCapitalize="characters"
            containerStyle={styles.grow}
            inset
          />
          <ActionButton
            label="Join"
            accent
            testID="join-group"
            disabled={joinCode.trim().length === 0 || displayName.trim().length === 0}
            onPress={() => {
              primeAudio();
              Keyboard.dismiss();
              run(async () => {
                const groupId = await joinGroup({ joinCode, displayName }).finally(() => void clearPendingJoin());
                setJoinCode("");
                setDisplayName("");
                router.push({ pathname: "/group/[groupId]", params: { groupId } });
              });
            }}
          />
        </View>
      </Card>

      <Card title="Create a Group">
        {isGuest ? (
          <ActionButton variant="outline" leading={<GoogleMark />} label="Sign in with Google" testID="google-sign-in" onPress={() => run(signInWithGoogle)} />
        ) : usage && !usage.enforced && !canCreateGroupBeforeLaunch(usage.groups) ? (
          <ThemedText type="caption" themeColor="textSecondary" testID="create-at-launch-limit">
            {`You can create up to ${LAUNCH_LIMITS.groups} Groups for now.`}
          </ThemedText>
        ) : usage?.enforced && (usage.plan === "free" || !canCreateGroup(usage.plan, usage.groups)) ? (
          <>
            <ThemedText type="caption" themeColor="textSecondary" testID="create-needs-plan">
              {usage.plan === "free"
                ? "Creating a Group needs Plus or Pro. Joining Groups is always free."
                : `You are using all ${usage.limits.groups} Groups ${PLAN_NAMES[usage.plan]} includes. Pro has no limit.`}
            </ThemedText>
            <ActionButton accent icon="star" label={usage.plan === "free" ? "See plans" : "Upgrade to Pro"} testID="see-plans" onPress={() => router.push("/subscribe")} />
          </>
        ) : (
          <View style={styles.inline}>
            <Field
              label="Group name"
              testID="group-name-input"
              value={groupName}
              onChangeText={setGroupName}
              placeholder="e.g. Sunday worship"
              autoCapitalize="words"
              containerStyle={styles.grow}
              inset
            />
            <ActionButton
              label="Create"
              accent
              testID="create-group"
              disabled={groupName.trim().length === 0 || usage === undefined}
              onPress={() => {
                primeAudio();
                Keyboard.dismiss();
                run(async () => {
                  const { groupId } = await createGroup({ name: groupName, displayName });
                  setGroupName("");
                  setDisplayName("");
                  router.push({ pathname: "/group/[groupId]", params: { groupId } });
                });
              }}
            />
          </View>
        )}
      </Card>

      <AboutLink />
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.two },
  inline: { flexDirection: "row", gap: Spacing.two, alignItems: "flex-end" },
  grow: { flex: 1, minWidth: 0 },
});
