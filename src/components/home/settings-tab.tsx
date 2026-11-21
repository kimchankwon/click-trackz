import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useGoogleSignIn } from "@/auth/use-google-sign-in";
import { forgetGuestHandoff } from "@/auth/guest-handoff";
import type { Run } from "@/components/home/run";
import { ActionButton } from "@/components/action-button";
import { Card } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { AccentPicker } from "@/components/ui/accent-picker";
import { GoogleMark } from "@/components/ui/google-mark";
import { Icon } from "@/components/ui/icon";
import { Spacing } from "@/constants/theme";
import { useConnected } from "@/lib/use-connected";
import { forgetStoredHome, useStoredHome } from "@/home/use-stored-home";
import { forgetStoredLibrary } from "@/library/use-my-library";
import { api } from "../../../convex/_generated/api";

export function SettingsTab({ run }: { run: Run }) {
  const connected = useConnected();
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
        disabled={!connected}
        onPress={() =>
          run(async () => {
            await signOut();
            await Promise.all([forgetStoredLibrary(), forgetStoredHome(), forgetGuestHandoff()]);
          })
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  pageHead: { gap: Spacing.one },
  account: { flexDirection: "row", alignItems: "center", gap: Spacing.one + 2 },
  grow: { flex: 1, minWidth: 0 },
});
