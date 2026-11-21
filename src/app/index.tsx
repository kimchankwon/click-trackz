import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useGoogleReturn, useGoogleSignIn } from "@/auth/use-google-sign-in";
import { forgetGuestHandoff, useClaimGuestHandoff } from "@/auth/guest-handoff";
import { useSignedInHere } from "@/auth/use-signed-in-here";
import { AboutPage } from "@/components/about/about-page";
import { AboutLink } from "@/components/home/about-link";
import { SignedInHome } from "@/components/home/signed-in-home";
import { ActionButton } from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GoogleMark } from "@/components/ui/google-mark";
import { LogoMark } from "@/components/ui/logo-mark";
import { Connecting } from "@/components/ui/connecting";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { errorText } from "@/lib/error-text";
import { readPendingJoin } from "@/lib/pending-join";
import { forgetStoredHome } from "@/home/use-stored-home";
import { forgetStoredLibrary } from "@/library/use-my-library";
import { api } from "../../convex/_generated/api";

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

  const running = useRef(false);
  const run = useCallback((action: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    action()
      .catch((e: unknown) => setError(errorText(e)))
      .finally(() => {
        running.current = false;
        setBusy(false);
      });
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
                  {invite !== null ? (
                    <ThemedText type="smallBold" themeColor="accent" style={styles.centered} testID="invite-notice">
                      You have an invite to join a Group.
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
  welcome: { flexGrow: 1, justifyContent: "center", paddingBottom: "18%", gap: Spacing.five },
  brand: { alignItems: "center", gap: Spacing.three },
  logo: { marginBottom: Spacing.two },
  signInButtons: { gap: Spacing.three },
  centered: { textAlign: "center" },
});
