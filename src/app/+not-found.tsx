import { router } from "expo-router";

import { GoneNotice } from "@/components/ui/gone-notice";

export default function NotFoundScreen() {
  return (
    <GoneNotice
      title="Nothing here"
      message="That link does not lead anywhere in Click Trackz."
      action="Go to Click Trackz"
      onPress={() => router.replace("/")}
      testID="not-found"
    />
  );
}
