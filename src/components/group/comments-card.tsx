import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { Card } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/avatar";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { GroupChat } from "@/chat/use-group-chat";
import { activityWhen } from "@/lib/activity-when";
import { cleanComment, MAX_COMMENT_LENGTH, REACTIONS } from "@/lib/chat";
import { errorText } from "@/lib/error-text";

const LIST_HEIGHT = 240;
const CLOCK_MS = 30_000;

export function CommentsCard({ chat, viewerId }: { chat: GroupChat; viewerId: string | undefined }) {
  const theme = useTheme();
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const newest = chat.comments.at(-1)?.chatId;
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (newest !== undefined) list.current?.scrollToEnd({ animated: true });
  }, [newest]);

  const send = () => {
    const text = cleanComment(draft);
    if (text.length === 0 || sending) return;
    setSending(true);
    setProblem(null);
    chat
      .comment(text)
      .then(() => setDraft(""))
      .catch((error: unknown) => setProblem(errorText(error)))
      .finally(() => setSending(false));
  };

  const react = (reaction: (typeof REACTIONS)[number]) => {
    setProblem(null);
    chat.react(reaction).catch((error: unknown) => setProblem(errorText(error)));
  };

  return (
    <Card title="Comments">
      <ScrollView
        ref={list}
        nestedScrollEnabled
        style={[styles.list, { backgroundColor: theme.background, borderColor: theme.border }]}
        contentContainerStyle={styles.listContent}
        testID="comments-list"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
      >
        {chat.canLoadOlder || chat.loadingOlder ? (
          <View style={styles.older}>
            <ActionButton tiny variant="pill" label={chat.loadingOlder ? "Loading…" : "Show older"} disabled={chat.loadingOlder} testID="comments-older" onPress={chat.loadOlder} />
          </View>
        ) : null}
        {!chat.loaded ? (
          <ThemedText type="small" themeColor="textSecondary">
            Loading…
          </ThemedText>
        ) : chat.comments.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" testID="comments-empty">
            No Comments yet.
          </ThemedText>
        ) : (
          chat.comments.map((entry) => (
            <View key={entry.chatId} style={styles.row} testID="comment">
              <Avatar name={entry.name} size={24} />
              <View style={styles.grow}>
                <View style={styles.meta}>
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
                    {entry.userId === viewerId ? `${entry.name} (you)` : entry.name}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textTertiary">
                    {activityWhen(entry.at, Math.max(nowMs, entry.at))}
                  </ThemedText>
                </View>
                <ThemedText type="small" selectable>
                  {entry.text}
                </ThemedText>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <View style={styles.reactions} role="group" aria-label="Reactions">
        {REACTIONS.map((reaction) => (
          <Pressable
            key={reaction}
            role="button"
            aria-label={`Send ${reaction}`}
            testID={`react-${reaction}`}
            onPress={() => react(reaction)}
            style={({ pressed }) => [styles.reaction, { backgroundColor: pressed ? theme.backgroundSelected : theme.background, borderColor: theme.border }]}
          >
            <Text style={styles.reactionText}>{reaction}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.compose}>
        <Field
          containerStyle={styles.grow}
          aria-label="Comment"
          placeholder="Say something to the Group"
          value={draft}
          onChangeText={setDraft}
          maxLength={MAX_COMMENT_LENGTH}
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={send}
          testID="comment-input"
          compact
          inset
        />
        <IconButton icon="send" label="Send Comment" color="accent" filled disabled={sending || cleanComment(draft).length === 0} onPress={send} testID="comment-send" />
      </View>
      {problem ? (
        <ThemedText type="small" themeColor="danger" role="alert" testID="comment-problem">
          {problem}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: LIST_HEIGHT, borderRadius: Radius.md, borderWidth: 1 },
  listContent: { gap: Spacing.three, padding: Spacing.three },
  older: { alignItems: "center" },
  row: { flexDirection: "row", gap: Spacing.two, alignItems: "flex-start" },
  grow: { flex: 1, minWidth: 0 },
  meta: { flexDirection: "row", alignItems: "baseline", gap: Spacing.two },
  name: { flexShrink: 1 },
  reactions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  reaction: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  reactionText: { fontSize: 22, lineHeight: 28 },
  compose: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
});
