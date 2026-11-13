import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Link, router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useGoogleReturn, useGoogleSignIn } from "@/auth/use-google-sign-in";
import { forgetGuestHandoff, useClaimGuestHandoff } from "@/auth/guest-handoff";
import { useSignedInHere } from "@/auth/use-signed-in-here";
import { AboutPage } from "@/components/about/about-page";
import { ActionButton } from "@/components/action-button";
import { primeAudio } from "@/audio/primed-context";
import { useSpeakerPreview } from "@/audio/use-speaker-preview";
import { Card } from "@/components/group/card";
import { GroupList } from "@/components/group/group-list";
import { panelId, TabBar, tabId, type TabItem } from "@/components/group/tab-bar";
import { SoundSettings } from "@/components/sound/sound-settings";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AccentPicker } from "@/components/ui/accent-picker";
import { Field } from "@/components/ui/field";
import { GoogleMark } from "@/components/ui/google-mark";
import { Icon } from "@/components/ui/icon";
import { LogoMark } from "@/components/ui/logo-mark";
import { ConnectionBadge } from "@/components/ui/connection-badge";
import { Connecting } from "@/components/ui/connecting";
import { TabPager } from "@/components/ui/tab-pager";
import { useDockInset } from "@/components/ui/use-dock-inset";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { clearPendingJoin, readPendingJoin } from "@/lib/pending-join";
import { useConnected } from "@/lib/use-connected";
import { useServerNow } from "@/lib/use-server-now";
import { useRoundTrip } from "@/sync/use-round-trip";
import { canCreateGroup, PLAN_NAMES } from "@/lib/plans";
import { forgetStoredHome, useKeepHomeOnDevice, useStoredHome } from "@/home/use-stored-home";
import { forgetStoredLibrary, useStoredLibrary } from "@/library/use-my-library";
import { onlineCount } from "@/presence/online";
import { useSoundSettings } from "@/settings/use-sound-settings";
import { api } from "../../convex/_generated/api";

const ONLINE_REFRESH_MS = 15_000;

type HomeTab = "groups" | "sound" | "settings";

const homeTabs: readonly TabItem<HomeTab>[] = [
  { id: "groups", label: "Groups", icon: "group" },
  { id: "sound", label: "Sound", icon: "sound" },
  { id: "settings", label: "Settings", icon: "settings" },
];

type Run = (action: () => Promise<unknown>) => void;

function AboutLink() {
  return (
    <Link href="/about" testID="about-link" style={styles.aboutLink}>
      <ThemedText type="smallBold" themeColor="accent">
        About Click Trackz
      </ThemedText>
    </Link>
  );
}

function GroupsTab({ run, active }: { run: Run; active: boolean }) {
  const viewer = useQuery(api.users.viewer, {});
  const liveGroups = useQuery(api.groups.myGroups, {});
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
  const [invited, setInvited] = useState(readPendingJoin);
  const [joinCode, setJoinCode] = useState(invited ?? "");
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

      {groups !== undefined && groups.length === 0 ? <ThemedText themeColor="textSecondary">Join a Group with its code to get started.</ThemedText> : null}
      {joinedGroups.length > 0 ? <GroupList groups={joinedGroups} onlineIn={onlineIn} testID="joined-groups" /> : null}
      {ownedGroups.length > 0 ? (
        <View style={styles.subsection}>
          <ThemedText type="subtitle" role="heading" testID="your-groups-heading">
            Your Groups
          </ThemedText>
          <GroupList groups={ownedGroups} onlineIn={onlineIn} testID="your-groups" />
        </View>
      ) : null}

      <Card title="My Library">
        <ThemedText type="caption" themeColor="textSecondary">
          {`Your own Songs and Setlists, kept on this device too, so they play with no connection and no one else following.${usage?.enforced ? " Free holds 10 Songs; Plus and Pro hold 1000." : ""}`}
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
            onPress={() => {
              primeAudio();
              run(async () => {
                const groupId = await joinGroup({ joinCode, displayName });
                void clearPendingJoin();
                setInvited(null);
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
          <>
            <ThemedText type="caption" themeColor="textSecondary">
              Guests can join Groups. Sign in to start your own.
            </ThemedText>
            <ActionButton variant="outline" leading={<GoogleMark />} label="Sign in with Google" testID="google-sign-in" onPress={() => run(signInWithGoogle)} />
          </>
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

function SoundTab({ active }: { active: boolean }) {
  const { sound, update, saveError } = useSoundSettings();
  const focused = useIsFocused();
  const preview = useSpeakerPreview(active && focused, sound.voiceVolume);
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
  const storedHome = useStoredHome();
  const { signOut } = useAuthActions();
  const signInWithGoogle = useGoogleSignIn();
  const isGuest = viewer?.isAnonymous ?? storedHome?.isAnonymous ?? true;
  const knownAccount = viewer != null || storedHome != null;
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
            {knownAccount ? (isGuest ? "Signed in as a guest" : "Signed in with Google") : "Loading…"}
          </ThemedText>
        </View>
        {viewer && isGuest ? (
          <ActionButton variant="outline" leading={<GoogleMark />} label="Sign in with Google" testID="settings-google-sign-in" onPress={() => run(signInWithGoogle)} />
        ) : null}
        {viewer && !isGuest ? <ActionButton variant="outline" icon="star" label="Plans and subscription" testID="settings-plans" onPress={() => router.push("/subscribe")} /> : null}
      </Card>
      <AccentPicker />
      <ActionButton
        variant="danger"
        icon="logout"
        label="Sign out"
        testID="sign-out"
        onPress={() =>
          run(async () => {
            await Promise.all([forgetStoredLibrary(), forgetStoredHome(), forgetGuestHandoff()]);
            await signOut();
            await forgetStoredHome();
          })
        }
      />
    </>
  );
}

function SignedInHome({ run, footer }: { run: Run; footer: ReactNode }) {
  const theme = useTheme();
  const dockInset = useDockInset(Spacing.one);
  const [tab, setTab] = useState<HomeTab>("groups");
  const showTab = useCallback((next: HomeTab) => setTab(next), []);
  const panes: readonly [HomeTab, ReactNode][] = [
    ["groups", <GroupsTab key="groups" run={run} active={tab === "groups"} />],
    ["sound", <SoundTab key="sound" active={tab === "sound"} />],
    ["settings", <SettingsTab key="settings" run={run} />],
  ];
  return (
    <>
      <TabPager
        active={tab}
        onChange={showTab}
        pages={panes.map(([pane, content]) => ({
          key: pane,
          content: (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <View role="tabpanel" id={panelId(pane, "home")} aria-labelledby={tabId(pane, "home")} style={styles.pane}>
                {content}
              </View>
              {pane === tab ? footer : null}
            </ScrollView>
          ),
        }))}
      />
      <View style={[styles.dock, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: dockInset }]}>
        <TabBar tabs={homeTabs} active={tab} onChange={showTab} scope="home" />
      </View>
    </>
  );
}

export default function HomeScreen() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signedIn, settling } = useSignedInHere();
  const { signIn, signOut } = useAuthActions();
  const signInWithGoogle = useGoogleSignIn();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const accountGone = isAuthenticated && viewer === null;
  useEffect(() => {
    if (!accountGone) return;
    void Promise.all([forgetStoredLibrary(), forgetStoredHome(), forgetGuestHandoff()])
      .then(() => signOut().catch(() => undefined))
      .then(forgetStoredHome);
  }, [accountGone, signOut]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite] = useState(readPendingJoin);
  const { start } = useLocalSearchParams<{ start?: string }>();
  const [signingIn, setSigningIn] = useState(start === "1");

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
  useClaimGuestHandoff(isAuthenticated && viewer != null && !viewer.isAnonymous);
  useGoogleReturn({
    settled: !isLoading && (!isAuthenticated || viewer !== undefined),
    signedInWithGoogle: isAuthenticated && viewer != null && !viewer.isAnonymous,
    onRetry: retryGoogle,
    onGiveUp: explainGoogle,
  });

  const showAbout = !signedIn && !settling && !signingIn && invite === null && error === null && !busy;

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
      <SafeAreaView style={styles.safeArea} edges={signedIn ? ["top", "left", "right"] : showAbout ? [] : undefined}>
        {signedIn ? (
          <SignedInHome run={run} footer={feedback} />
        ) : showAbout ? (
          <AboutPage signedIn={false} onGetStarted={() => setSigningIn(true)} />
        ) : (
          <ScrollView contentContainerStyle={[styles.content, styles.welcome]} keyboardShouldPersistTaps="handled">
            {settling ? (
              <Connecting />
            ) : (
              <>
                <View style={styles.brand}>
                  <LogoMark size={80} style={styles.logo} />
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
                  <AboutLink />
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
  dock: { paddingHorizontal: Spacing.four, borderTopWidth: StyleSheet.hairlineWidth },
  welcome: { flexGrow: 1, justifyContent: "center", paddingBottom: "18%", gap: Spacing.five },
  helper: { maxWidth: 300, alignSelf: "center" },
  brand: { alignItems: "center", gap: Spacing.three },
  logo: { marginBottom: Spacing.two },
  signInButtons: { gap: Spacing.three },
  centered: { textAlign: "center" },
  pageHead: { gap: Spacing.one },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.two },
  account: { flexDirection: "row", alignItems: "center", gap: Spacing.one + 2 },
  subsection: { gap: Spacing.two },
  inline: { flexDirection: "row", gap: Spacing.two, alignItems: "flex-end" },
  grow: { flex: 1, minWidth: 0 },
  aboutLink: { alignSelf: "center", paddingVertical: Spacing.two },
});
