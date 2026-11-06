import * as Clipboard from "expo-clipboard";
import { Platform, Pressable, Share, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import type { ToastTone } from "@/components/ui/toast";
import { Spacing } from "@/constants/theme";
import { errorText } from "@/lib/error-text";
import { inviteLink, inviteText } from "@/lib/invite";
import { siteUrl } from "@/lib/site-url";

type WebShare = { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };

const isCancelledShare = (error: unknown) => error instanceof Error && error.name === "AbortError";

export function JoinCodeActions({
  code,
  groupName,
  onDone,
}: {
  code: string;
  groupName: string;
  onDone: (message: string, tone?: ToastTone) => void;
}) {
  const copyCode = () => {
    Clipboard.setStringAsync(code).then(
      () => onDone(`Join code ${code} copied`),
      (error: unknown) => onDone(`Could not copy the join code. ${errorText(error)}`, "error"),
    );
  };

  const shareLink = async () => {
    const link = inviteLink(siteUrl(), code);
    const text = inviteText(groupName);
    try {
      if (Platform.OS !== "web") {
        await Share.share({ message: `${text}: ${link}` });
        return;
      }
      const browser = navigator as WebShare;
      if (typeof browser.share === "function") {
        try {
          await browser.share({ title: "Click Trackz", text, url: link });
          return;
        } catch (error) {
          if (isCancelledShare(error)) return;
        }
      }
      await Clipboard.setStringAsync(link);
      onDone("Invite link copied");
    } catch (error) {
      if (!isCancelledShare(error)) onDone(`Could not share the invite. ${errorText(error)}`, "error");
    }
  };

  return (
    <View style={styles.actions}>
      <Pressable role="button" aria-label={`Copy join code ${code}`} testID="copy-join-code" hitSlop={8} onPress={copyCode} style={styles.row}>
        <ThemedText type="caption" themeColor="textSecondary">
          Join code
        </ThemedText>
        <ThemedText type="caption" themeColor="accent" style={styles.code}>
          {code}
        </ThemedText>
        <Icon name="copy" size={14} color="accent" />
      </Pressable>
      <Pressable role="button" aria-label="Share invite link" testID="share-invite" hitSlop={8} onPress={() => void shareLink()} style={styles.share}>
        <Icon name="share" size={14} color="accent" />
        <ThemedText type="caption" themeColor="accent" style={styles.code}>
          Invite
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: Spacing.three, rowGap: Spacing.half },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  code: { fontWeight: 700, letterSpacing: 0.5 },
  share: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
});
