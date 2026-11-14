import { usePaginatedQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { Card } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { Dropdown } from "@/components/ui/dropdown";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { activityWhen } from "@/lib/activity-when";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const PAGE = 20;
const SHOWN_DETAILS = 2;
const CLOCK_MS = 30_000;

type Shown = "all" | "playback" | "song" | "setlist" | "group" | "comment";

const SHOWN_OPTIONS: readonly { value: Shown; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "playback", label: "Playback" },
  { value: "song", label: "Songs" },
  { value: "setlist", label: "Setlists" },
  { value: "group", label: "Members and Group" },
  { value: "comment", label: "Comments" },
];

const COLLAPSED_HEIGHT = 300;

export function ActivityCard({ groupId, opened }: { groupId: Id<"groups">; opened: boolean }) {
  const theme = useTheme();
  const [shown, setShown] = useState<Shown>("all");
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, []);
  const { results, status, loadMore } = usePaginatedQuery(
    api.activity.list,
    opened ? { groupId, kind: shown === "all" ? undefined : shown } : "skip",
    { initialNumItems: PAGE },
  );
  const toggle = (activityId: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  return (
    <Card title="Activity">
      <View style={styles.controls}>
        <View style={styles.grow}>
          <Dropdown label="Show" testID="activity-shown" options={SHOWN_OPTIONS} value={shown} onChange={setShown} />
        </View>
        <ActionButton
          small
          variant="secondary"
          icon={expanded ? "collapse" : "expand"}
          label={expanded ? "Collapse" : "Expand"}
          testID="activity-expand"
          onPress={() => setExpanded(!expanded)}
        />
      </View>
      {status === "LoadingFirstPage" ? (
        <ThemedText type="small" themeColor="textSecondary" testID="activity-loading">
          Loading…
        </ThemedText>
      ) : results.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" testID="activity-empty">
          Nothing yet. Comments, changes to Songs, Setlists and Members, and every Start, Jump and Stop show here.
        </ThemedText>
      ) : (
        <ScrollView
          nestedScrollEnabled
          style={[styles.list, { borderColor: theme.border }, expanded ? null : styles.collapsed]}
          contentContainerStyle={styles.listContent}
          testID="activity-list"
        >
          {results.map((row, index) => {
            const expanded = open.has(row.activityId) || row.details.length <= SHOWN_DETAILS;
            return (
              <View key={row.activityId} style={styles.item} testID={`activity-${index}`}>
                {index > 0 ? <View style={[styles.separator, { backgroundColor: theme.border }]} /> : null}
                <ThemedText style={styles.summary} testID={`activity-${index}-summary`}>
                  {row.summary}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" testID={`activity-${index}-by`}>
                  {row.actorName} · {activityWhen(row.at, Math.max(nowMs, row.at))}
                </ThemedText>
                {expanded && row.details.length > 0 ? (
                  <View style={styles.details} testID={`activity-${index}-details`}>
                    {row.details.map((line, lineIndex) => (
                      <ThemedText key={lineIndex} type="small" themeColor="textSecondary" selectable>
                        {line}
                      </ThemedText>
                    ))}
                  </View>
                ) : null}
                {row.details.length > SHOWN_DETAILS ? (
                  <View style={styles.toggle}>
                    <ActionButton
                      tiny
                      variant="pill"
                      label={open.has(row.activityId) ? "Hide changes" : `Show ${row.details.length} changes`}
                      testID={`activity-${index}-toggle`}
                      onPress={() => toggle(row.activityId)}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
          {status === "CanLoadMore" || status === "LoadingMore" ? (
            <View style={styles.more}>
              <ActionButton
                variant="secondary"
                label={status === "LoadingMore" ? "Loading…" : "Show older"}
                testID="activity-more"
                disabled={status === "LoadingMore"}
                onPress={() => loadMore(PAGE)}
              />
            </View>
          ) : null}
        </ScrollView>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  grow: { flex: 1, minWidth: 0 },
  list: { borderWidth: 1, borderRadius: Radius.md },
  collapsed: { maxHeight: COLLAPSED_HEIGHT },
  listContent: { padding: Spacing.three },
  more: { marginTop: Spacing.three },
  item: { gap: 2 },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.two },
  summary: { fontWeight: 600 },
  details: { gap: 2, marginTop: Spacing.one, paddingLeft: Spacing.two },
  toggle: { flexDirection: "row", marginTop: Spacing.one },
});
