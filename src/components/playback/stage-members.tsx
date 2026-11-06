import { StyleSheet, View } from "react-native";

import { DISC } from "@/components/playback/beat-pulse";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/use-theme";

export type StageMember = { userId: string; name: string; online: boolean; position: number };

const AVATAR = 32;
const RING = 2.5;
export const MAX_PER_SIDE = 5;

export function StageMembers({ members, extra = 0 }: { members: readonly StageMember[]; extra?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.column}>
      {members.map((member) => (
        <View
          key={member.userId}
          testID={`stage-member-${member.name}`}
          aria-label={`${member.name}, ${member.online ? "online" : "offline"}`}
          style={[styles.ring, { borderColor: member.online ? theme.switchOn : theme.dotInactive }, member.online ? null : styles.offline]}
        >
          <Avatar name={member.name} size={AVATAR} position={member.position} />
        </View>
      ))}
      {extra > 0 ? (
        <View style={[styles.ring, styles.more, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.moreText}>
            +{extra}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: AVATAR + RING * 2 + 4, height: DISC, justifyContent: "center", alignItems: "center", gap: 6 },
  ring: { borderWidth: RING, borderRadius: AVATAR, padding: 1 },
  offline: { opacity: 0.55 },
  more: { width: AVATAR + RING * 2 + 2, height: AVATAR + RING * 2 + 2, alignItems: "center", justifyContent: "center" },
  moreText: { fontSize: 12, fontWeight: 700 },
});
