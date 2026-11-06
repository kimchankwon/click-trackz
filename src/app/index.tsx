import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useCallback, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useGoogleReturn, useGoogleSignIn } from "@/auth/use-google-sign-in";
import { ActionButton } from "@/components/action-button";
import { useSpeakerPreview } from "@/audio/use-speaker-preview";
import { Card } from "@/components/group/card";
import { panelId, TabBar, tabId, type TabItem } from "@/components/group/tab-bar";
import { SoundSettings } from "@/components/sound/sound-settings";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AccentPicker } from "@/components/ui/accent-picker";
import { Avatar } from "@/components/ui/avatar";
import { Field } from "@/components/ui/field";
import { GoogleMark } from "@/components/ui/google-mark";
import { Icon } from "@/components/ui/icon";
import { SwipeTabs } from "@/components/ui/swipe-tabs";
import { useDockInset } from "@/components/ui/use-dock-inset";
import { MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { clearPendingJoin, readPendingJoin } from "@/lib/pending-join";
import { useSoundSettings } from "@/settings/use-sound-settings";
import { api } from "../../convex/_generated/api";

type HomeTab = "groups" | "sound" | "settings";

const homeTabs: readonly TabItem<HomeTab>[] = [
  { id: "groups", label: "Groups", icon: "group" },
  { id: "sound", label: "Sound", icon: "sound" },
  { id: "settings", label: "Settings", icon: "settings" },
];
const homeTabIds = homeTabs.map((item) => item.id);

type Run = (action: () => Promise<unknown>) => void;

function GroupsTab({ run }: { run: Run }) {
  const viewer = useQuery(api.users.viewer, {});
  const groups = useQuery(api.groups.myGroups, {});
  const createGroup = useMutation(api.groups.createGroup);
  const joinGroup = useMutation(api.groups.joinGroup);
  const signInWithGoogle = useGoogleSignIn();
  const theme = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [invited, setInvited] = useState(readPendingJoin);
  const [joinCode, setJoinCode] = useState(invited ?? "");
  const [groupName, setGroupName] = useState("");
  const isGuest = viewer?.isAnonymous ?? true;

  return (
    <>
      <View style={styles.pageHead}>
        <ThemedText type="title" role="heading">
          Your Groups
        </ThemedText>
        <View style={styles.account}>
          <Icon name="person" size={16} color="textSecondary" />
          <ThemedText type="caption" themeColor="textSecondary" testID="viewer-status">
            {viewer ? (isGuest ? "Signed in as a guest" : "Signed in with Google") : "Loading…"}
          </ThemedText>
        </View>
      </View>

      {(groups ?? []).length === 0 ? (
        <ThemedText themeColor="textSecondary">Join a Group with its code to get started.</ThemedText>
      ) : (
        <View style={[styles.list, { backgroundColor: theme.backgroundElement }]}>
          {(groups ?? []).map((group, index) => (
            <Pressable
              key={group.groupId}
              role="link"
              testID={`open-group-${group.name}`}
              onPress={() => router.push({ pathname: "/group/[groupId]", params: { groupId: group.groupId } })}
              style={({ pressed }) => [styles.groupRow, pressed ? { backgroundColor: theme.backgroundSelected } : null]}
            >
              {index > 0 ? <View style={[styles.separator, { backgroundColor: theme.border }]} /> : null}
              <Avatar name={group.name} position={index} />
              <View style={styles.grow}>
                <ThemedText type="default" style={styles.groupName} numberOfLines={1}>
                  {group.name}
                </ThemedText>
                <View style={styles.roleRow}>
                  <Icon name={group.role === "admin" ? "admin" : "member"} size={16} color="textSecondary" />
                  <ThemedText themeColor="textSecondary" style={styles.role}>
                    {group.role === "admin" ? "Admin" : "Member"}
                  </ThemedText>
                </View>
              </View>
              <Icon name="forward" size={22} color="textTertiary" />
            </Pressable>
          ))}
        </View>
      )}

      <Card title="Join a Group">
        {invited !== null && joinCode === invited ? (
          <ThemedText type="caption" themeColor="accent" testID="invite-ready">
            Your invite code is filled in. Add your name and tap Join.
          </ThemedText>
        ) : null}
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
            disabled={joinCode.trim().length === 0}
            onPress={() =>
              run(async () => {
                const groupId = await joinGroup({ joinCode, displayName });
                void clearPendingJoin();
                setInvited(null);
                setJoinCode("");
                setDisplayName("");
                router.push({ pathname: "/group/[groupId]", params: { groupId } });
              })
            }
          />
        </View>
      </Card>

      <Card title="Create a Group">
        {isGuest ? (
          <>
            <ThemedText type="caption" themeColor="textSecondary">
              Guests can join Groups. Sign in to start your own.
            </ThemedText>
            <ActionButton variant="outline" leading={<GoogleMark />} label="Sign in with Google" testID="google-sign-in" onPress={() => run(signInWithGoogle)} />
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
              disabled={groupName.trim().length === 0}
              onPress={() =>
                run(async () => {
                  const { groupId } = await createGroup({ name: groupName, displayName });
                  setGroupName("");
                  setDisplayName("");
                  router.push({ pathname: "/group/[groupId]", params: { groupId } });
                })
              }
            />
          </View>
        )}
      </Card>

    </>
  );
}

function SoundTab({ active }: { active: boolean }) {
  const { sound, update, saveError } = useSoundSettings();
  const preview = useSpeakerPreview(active, sound.voiceVolume);
  return (
    <>
      <View style={styles.pageHead}>
        <ThemedText type="title" role="heading">
          Sound
        </ThemedText>
      </View>
      <SoundSettings sound={sound} update={update} saveError={saveError} speakerHint="Tap a Speaker to hear it." onSpeaker={preview} />
    </>
  );
}

function SettingsTab({ run }: { run: Run }) {
  const viewer = useQuery(api.users.viewer, {});
  const { signOut } = useAuthActions();
  const signInWithGoogle = useGoogleSignIn();
  const isGuest = viewer?.isAnonymous ?? true;
  return (
    <>
      <View style={styles.pageHead}>
        <ThemedText type="title" role="heading">
          Settings
        </ThemedText>
      </View>
      <Card title="Account">
        <View style={styles.account}>
          <Icon name="person" size={18} color="textSecondary" />
          <ThemedText testID="settings-account" style={styles.grow}>
            {viewer ? (isGuest ? "Signed in as a guest" : "Signed in with Google") : "Loading…"}
          </ThemedText>
        </View>
        {viewer && isGuest ? (
          <ActionButton variant="outline" leading={<GoogleMark />} label="Sign in with Google" testID="settings-google-sign-in" onPress={() => run(signInWithGoogle)} />
        ) : null}
      </Card>
      <AccentPicker />
      <ActionButton variant="danger" icon="logout" label="Sign out" testID="sign-out" onPress={() => run(signOut)} />
    </>
  );
}

function SignedInHome({ run, footer }: { run: Run; footer: ReactNode }) {
  const theme = useTheme();
  const dockInset = useDockInset(Spacing.one);
  const [tab, setTab] = useState<HomeTab>("groups");
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const showTab = useCallback((next: HomeTab) => {
    setTab(next);
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, []);
  const panes: readonly [HomeTab, ReactNode][] = [
    ["groups", <GroupsTab key="groups" run={run} />],
    ["sound", <SoundTab key="sound" active={tab === "sound"} />],
    ["settings", <SettingsTab key="settings" run={run} />],
  ];
  return (
    <>
      <SwipeTabs tabs={homeTabIds} active={tab} onChange={showTab}>
        <ScrollView ref={scroller} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {panes.map(([pane, content]) => (
            <View
              key={pane}
              role="tabpanel"
              id={panelId(pane, "home")}
              aria-labelledby={tabId(pane, "home")}
              style={tab === pane ? styles.pane : styles.hidden}
            >
              {content}
            </View>
          ))}
          {footer}
        </ScrollView>
      </SwipeTabs>
      <View style={[styles.dock, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: dockInset }]}>
        <TabBar tabs={homeTabs} active={tab} onChange={showTab} scope="home" />
      </View>
    </>
  );
}

export default function HomeScreen() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const signInWithGoogle = useGoogleSignIn();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const [invite] = useState(readPendingJoin);

  const run = useCallback((action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    action()
      .catch((e: unknown) => setError(errorText(e)))
      .finally(() => setBusy(false));
  }, []);

  const retryGoogle = useCallback(() => run(() => signInWithGoogle({ retry: true })), [run, signInWithGoogle]);
  const explainGoogle = useCallback(
    () => setError("Google sign-in did not finish. Tap Sign in with Google to try again."),
    [],
  );
  useGoogleReturn({
    settled: !isLoading && (!isAuthenticated || viewer !== undefined),
    signedInWithGoogle: isAuthenticated && viewer != null && !viewer.isAnonymous,
    onRetry: retryGoogle,
    onGiveUp: explainGoogle,
  });

  const feedback = (
    <>
      {busy ? <ActivityIndicator /> : null}
      {error ? (
        <ThemedText type="small" themeColor="danger" testID="error" style={styles.centered}>
          {error}
        </ThemedText>
      ) : null}
    </>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={isAuthenticated ? ["top", "left", "right"] : undefined}>
        {isAuthenticated && !isLoading ? (
          <SignedInHome run={run} footer={feedback} />
        ) : (
          <ScrollView contentContainerStyle={[styles.content, styles.welcome]} keyboardShouldPersistTaps="handled">
            {isLoading ? (
              <ActivityIndicator />
            ) : (
              <>
                <View style={styles.brand}>
                  <View style={[styles.logo, { backgroundColor: theme.accent }]}>
                    <Icon name="pulse" size={40} color="onAccent" />
                  </View>
                  <ThemedText type="title" role="heading" style={styles.centered}>
                    Click Trackz
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.centered}>
                    Every device in the Group on the same beat.
                  </ThemedText>
                </View>
                <View style={styles.signInButtons}>
                  <ActionButton large accent label="Continue as guest" testID="guest-sign-in" onPress={() => run(() => signIn("anonymous"))} />
                  <ActionButton large variant="outline" leading={<GoogleMark />} label="Sign in with Google" testID="google-sign-in" onPress={() => run(signInWithGoogle)} />
                  <ThemedText type="small" themeColor="textSecondary" style={[styles.centered, styles.helper]}>
                    Guests can join a Group. Sign in with Google to create one.
                  </ThemedText>
                  {invite !== null ? (
                    <ThemedText type="smallBold" themeColor="accent" style={styles.centered} testID="invite-notice">
                      You have an invite to join a Group. Continue as a guest or sign in, then add your name.
                    </ThemedText>
                  ) : null}
                </View>
              </>
            )}
            {feedback}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  pane: { gap: Spacing.four },
  hidden: { display: "none" },
  dock: { paddingHorizontal: Spacing.four, borderTopWidth: StyleSheet.hairlineWidth },
  welcome: { flexGrow: 1, justifyContent: "center", paddingBottom: "18%", gap: Spacing.five },
  helper: { maxWidth: 300, alignSelf: "center" },
  brand: { alignItems: "center", gap: Spacing.three },
  logo: { width: 80, height: 80, borderRadius: Radius.lg + 4, alignItems: "center", justifyContent: "center", marginBottom: Spacing.two },
  signInButtons: { gap: Spacing.three },
  centered: { textAlign: "center" },
  pageHead: { gap: Spacing.one },
  account: { flexDirection: "row", alignItems: "center", gap: Spacing.one + 2 },
  list: { borderRadius: Radius.lg, overflow: "hidden" },
  inline: { flexDirection: "row", gap: Spacing.two, alignItems: "flex-end" },
  grow: { flex: 1, minWidth: 0 },
  groupRow: { flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 68, paddingHorizontal: Spacing.three },
  groupName: { fontWeight: 600, fontSize: 17 },
  role: { fontSize: 15, lineHeight: 20, fontWeight: 400 },
  roleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  separator: { position: "absolute", top: 0, left: 72, right: Spacing.three, height: StyleSheet.hairlineWidth },
});
