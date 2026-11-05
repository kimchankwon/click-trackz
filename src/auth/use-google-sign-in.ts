import { useAuthActions } from "@convex-dev/auth/react";
import * as Linking from "expo-linking";
import { maybeCompleteAuthSession, openAuthSessionAsync } from "expo-web-browser";
import { Platform } from "react-native";

maybeCompleteAuthSession();

export function useGoogleSignIn() {
  const { signIn } = useAuthActions();
  return async () => {
    const redirectTo = Platform.OS === "web" ? window.location.origin : Linking.createURL("/");
    const { redirect } = await signIn("google", { redirectTo });
    if (Platform.OS === "web" || !redirect) return;
    const result = await openAuthSessionAsync(redirect.toString(), redirectTo);
    if (result.type !== "success") return;
    const code = Linking.parse(result.url).queryParams?.code;
    if (typeof code === "string") await signIn("google", { code });
  };
}
