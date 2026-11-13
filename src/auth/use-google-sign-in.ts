import { useAuthActions } from "@convex-dev/auth/react";
import * as Linking from "expo-linking";
import { useNavigation } from "expo-router";
import type { NavigationProp } from "expo-router/react-navigation";
import { maybeCompleteAuthSession, openAuthSessionAsync } from "expo-web-browser";
import { useEffect } from "react";
import { Platform } from "react-native";

import { useStartGuestHandoff } from "./guest-handoff";
import { googleReturnAction } from "./google-return";
import { readPendingGoogleSignIn, writePendingGoogleSignIn } from "./pending-google";

maybeCompleteAuthSession();

let returnChecked = false;

export function useGoogleSignIn() {
  const { signIn } = useAuthActions();
  const startHandoff = useStartGuestHandoff();
  return async (options?: { retry?: boolean }) => {
    await startHandoff();
    const redirectTo = Platform.OS === "web" ? window.location.origin : Linking.createURL("/");
    if (Platform.OS === "web") writePendingGoogleSignIn({ startedAt: Date.now(), retried: options?.retry === true });
    const { redirect } = await signIn("google", { redirectTo });
    if (Platform.OS === "web" || !redirect) return;
    const result = await openAuthSessionAsync(redirect.toString(), redirectTo);
    if (result.type !== "success") return;
    const code = Linking.parse(result.url).queryParams?.code;
    if (typeof code === "string") await signIn("google", { code });
  };
}

export function useGoogleReturn({
  settled,
  signedInWithGoogle,
  onRetry,
  onGiveUp,
}: {
  settled: boolean;
  signedInWithGoogle: boolean;
  onRetry: () => void;
  onGiveUp: () => void;
}) {
  const navigation = useNavigation<NavigationProp<{ index: { code?: string } }, "index">>();
  useEffect(() => {
    if (!settled || returnChecked) return;
    returnChecked = true;
    if (Platform.OS === "web" && new URLSearchParams(window.location.search).has("code")) navigation.setParams({ code: undefined });
    const action = googleReturnAction({ pending: readPendingGoogleSignIn(), now: Date.now(), isAuthenticated: signedInWithGoogle });
    if (action === "clear") writePendingGoogleSignIn(null);
    if (action === "retry") onRetry();
    if (action === "explain") {
      writePendingGoogleSignIn(null);
      onGiveUp();
    }
  }, [settled, signedInWithGoogle, onRetry, onGiveUp, navigation]);
}
