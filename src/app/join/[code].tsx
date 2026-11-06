import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import { ThemedView } from "@/components/themed-view";
import { normalizeJoinCode } from "@/lib/invite";
import { savePendingJoin } from "@/lib/pending-join";

export default function JoinLinkScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    let cancelled = false;
    const joinCode = normalizeJoinCode(code);
    void (joinCode ? savePendingJoin(joinCode) : Promise.resolve()).then(() => {
      if (!cancelled) router.replace("/");
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <ThemedView style={styles.container}>
      <ActivityIndicator />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
