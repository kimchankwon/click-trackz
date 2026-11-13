import { router } from "expo-router";

import { AboutPage } from "@/components/about/about-page";
import { useSignedInHere } from "@/auth/use-signed-in-here";

export default function AboutScreen() {
  const { signedIn } = useSignedInHere();
  return (
    <AboutPage
      signedIn={signedIn}
      onGetStarted={() => (signedIn ? router.dismissTo("/") : router.replace({ pathname: "/", params: { start: "1" } }))}
    />
  );
}
