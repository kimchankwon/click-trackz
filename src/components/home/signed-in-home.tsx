import { useCallback, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { GroupsTab } from "@/components/home/groups-tab";
import { SoundTab } from "@/components/home/sound-tab";
import { SettingsTab } from "@/components/home/settings-tab";
import type { Run } from "@/components/home/run";
import { panelId, TabBar, tabId, type TabItem } from "@/components/group/tab-bar";
import { TabPager } from "@/components/ui/tab-pager";
import { useDockInset } from "@/components/ui/use-dock-inset";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type HomeTab = "groups" | "sound" | "settings";

const homeTabs: readonly TabItem<HomeTab>[] = [
  { id: "groups", label: "Groups", icon: "group" },
  { id: "sound", label: "Sound", icon: "sound" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export function SignedInHome({ run, footer }: { run: Run; footer: ReactNode }) {
  const theme = useTheme();
  const dockInset = useDockInset(Spacing.one);
  const [tab, setTab] = useState<HomeTab>("groups");
  const showTab = useCallback((next: HomeTab) => setTab(next), []);
  const panes: readonly [HomeTab, ReactNode][] = [
    ["groups", <GroupsTab key="groups" run={run} active={tab === "groups"} />],
    ["sound", <SoundTab key="sound" active={tab === "sound"} />],
    ["settings", <SettingsTab key="settings" run={run} />],
  ];
  return (
    <>
      <TabPager
        active={tab}
        onChange={showTab}
        pages={panes.map(([pane, content]) => ({
          key: pane,
          content: (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
              <View role="tabpanel" id={panelId(pane, "home")} aria-labelledby={tabId(pane, "home")} style={styles.pane}>
                {content}
              </View>
              {pane === tab ? footer : null}
            </ScrollView>
          ),
        }))}
      />
      <View style={[styles.dock, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: dockInset }]}>
        <TabBar tabs={homeTabs} active={tab} onChange={showTab} scope="home" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  pane: { gap: Spacing.four },
  dock: { paddingHorizontal: Spacing.four, borderTopWidth: StyleSheet.hairlineWidth },
});
