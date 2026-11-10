import { useCallback, useState, type ReactNode } from "react";
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export const PINNED_CONTENT_TOP = Spacing.two + Spacing.one;

export function usePinnedHeader() {
  const [scrolled, setScrolled] = useState(false);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > 0;
    setScrolled((previous) => (previous === next ? previous : next));
  }, []);
  return { scrolled, scrollProps: { onScroll, scrollEventThrottle: 16 } };
}

export function usePagedPinnedHeader<T extends string>(active: T) {
  const [scrolledPages, setScrolledPages] = useState<Partial<Record<T, boolean>>>({});
  const onScroll = useCallback((page: T, event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > 0;
    setScrolledPages((previous) => (previous[page] === next ? previous : { ...previous, [page]: next }));
  }, []);
  return { scrolled: scrolledPages[active] === true, onScroll };
}

export function PinnedHeader({ scrolled, children }: { scrolled: boolean; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View testID="pinned-header" style={[styles.bar, { backgroundColor: theme.background, borderBottomColor: scrolled ? theme.border : "transparent" }]}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: Spacing.three,
    paddingBottom: PINNED_CONTENT_TOP,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 1,
  },
  inner: { maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four, alignSelf: "center", width: "100%" },
});
