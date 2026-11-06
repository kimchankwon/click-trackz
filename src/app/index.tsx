import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useGoogleReturn, useGoogleSignIn } from "@/auth/use-google-sign-in";
import { ActionButton } from "@/components/action-button";
import { Card } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AccentPicker } from "@/components/ui/accent-picker";
import { Avatar } from "@/components/ui/avatar";
import { Field } from "@/components/ui/field";
import { GoogleMark } from "@/components/ui/google-mark";
import { Icon } from "@/components/ui/icon";
import { MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { api } from "../../convex/_generated/api";

function SignedInHome({ run }: { run: (action: () => Promise<unknown>) => void }) {
  const viewer = useQuery(api.users.viewer, {});
  const groups = useQuery(api.groups.myGroups, {});
  const createGroup = useMutation(api.groups.createGroup);
  const joinGroup = useMutation(api.groups.joinGroup);
  const { signOut } = useAuthActions();
  const signInWithGoogle = useGoogleSignIn();
  const theme = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
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
                  router.push({ pathname: "/group/[groupId]", params: { groupId } });
                })
              }
            />
          </View>
        )}
      </Card>

      <AccentPicker />

      <ActionButton variant="ghost" icon="logout" label="Sign out" testID="sign-out" onPress={() => run(signOut)} />
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[styles.content, isAuthenticated ? null : styles.welcome]}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading ? (
            <ActivityIndicator />
          ) : isAuthenticated ? (
            <SignedInHome run={run} />
          ) : (
            <>
              <View style={styles.brand}>
                <View style={[styles.logo, { backgroundColor: theme.accent }]}>
                  <Icon name="pulse" size={40} color="onAccent" />
                </View>
                <ThemedText type="title" role="heading" style={styles.centered}>
                  Cue Tracker
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
              </View>
            </>
          )}
          {busy ? <ActivityIndicator /> : null}
          {error ? (
            <ThemedText type="small" themeColor="danger" testID="error" style={styles.centered}>
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>
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
