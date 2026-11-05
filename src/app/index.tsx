import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useGoogleReturn, useGoogleSignIn } from "@/auth/use-google-sign-in";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { api } from "../../convex/_generated/api";

function Button({ label, onPress, testID, primary }: { label: string; onPress: () => void; testID?: string; primary?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      role="button"
      testID={testID}
      onPress={onPress}
      style={[styles.button, { backgroundColor: primary ? theme.accent : theme.backgroundElement }]}
    >
      <ThemedText style={primary ? { color: theme.onAccent } : null}>{label}</ThemedText>
    </Pressable>
  );
}

function Field(props: { value: string; onChangeText: (v: string) => void; placeholder: string; testID: string; autoCapitalize?: "none" | "characters" | "words" }) {
  const theme = useTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.textSecondary}
      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
    />
  );
}

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
      <ThemedText testID="viewer-status" themeColor="textSecondary">
        {viewer ? (isGuest ? "Signed in as a guest" : "Signed in") : "Loading…"}
      </ThemedText>

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          YOUR GROUPS
        </ThemedText>
        {(groups ?? []).length === 0 ? (
          <ThemedText themeColor="textSecondary">Join a Group with its code to get started.</ThemedText>
        ) : null}
        {(groups ?? []).map((group) => (
          <Pressable
            key={group.groupId}
            role="link"
            testID={`open-group-${group.name}`}
            onPress={() => router.push({ pathname: "/group/[groupId]", params: { groupId: group.groupId } })}
            style={[styles.groupRow, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText type="smallBold">{group.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {group.role === "admin" ? "Admin" : "Member"}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          YOUR NAME IN THE GROUP
        </ThemedText>
        <Field testID="display-name" value={displayName} onChangeText={setDisplayName} placeholder="e.g. Jisue" autoCapitalize="words" />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          JOIN A GROUP
        </ThemedText>
        <View style={styles.inline}>
          <View style={styles.grow}>
            <Field testID="join-code-input" value={joinCode} onChangeText={setJoinCode} placeholder="6-letter code" autoCapitalize="characters" />
          </View>
          <Button
            label="Join"
            testID="join-group"
            onPress={() =>
              run(async () => {
                const groupId = await joinGroup({ joinCode, displayName });
                router.push({ pathname: "/group/[groupId]", params: { groupId } });
              })
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          CREATE A GROUP
        </ThemedText>
        {isGuest ? (
          <Button label="Sign in with Google to create a Group" testID="google-sign-in" onPress={() => run(signInWithGoogle)} />
        ) : (
          <View style={styles.inline}>
            <View style={styles.grow}>
              <Field testID="group-name-input" value={groupName} onChangeText={setGroupName} placeholder="Group name" autoCapitalize="words" />
            </View>
            <Button
              label="Create"
              primary
              testID="create-group"
              onPress={() =>
                run(async () => {
                  const { groupId } = await createGroup({ name: groupName, displayName });
                  router.push({ pathname: "/group/[groupId]", params: { groupId } });
                })
              }
            />
          </View>
        )}
      </View>

      <Button label="Sign out" testID="sign-out" onPress={() => run(signOut)} />
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="title" style={styles.title}>
            Cue Tracker
          </ThemedText>
          {isLoading ? (
            <ActivityIndicator />
          ) : isAuthenticated ? (
            <SignedInHome run={run} />
          ) : (
            <View style={styles.section}>
              <Button label="Continue as guest" primary onPress={() => run(() => signIn("anonymous"))} />
              <Button label="Sign in with Google" testID="google-sign-in" onPress={() => run(signInWithGoogle)} />
            </View>
          )}
          {busy ? <ActivityIndicator /> : null}
          {error ? (
            <ThemedText themeColor="textSecondary" testID="error">
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
  content: { gap: Spacing.four, padding: Spacing.four, maxWidth: MaxContentWidth, alignSelf: "center", width: "100%" },
  title: { textAlign: "center", fontSize: 40, lineHeight: 48 },
  section: { gap: Spacing.two, width: "100%" },
  inline: { flexDirection: "row", gap: Spacing.two, alignItems: "center" },
  grow: { flex: 1 },
  input: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, borderRadius: Spacing.three, fontSize: 16 },
  button: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: Spacing.three, alignItems: "center" },
  groupRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
