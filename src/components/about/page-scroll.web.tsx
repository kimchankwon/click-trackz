import { useLayoutEffect, useRef, type ComponentRef, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

const FREED = { height: "auto", minHeight: "0", flex: "0 0 auto", width: "100%", overflow: "visible", position: "relative" } as const;

function freeAncestors(page: HTMLElement): () => void {
  const saved: [HTMLElement, string][] = [];
  for (let element = page.parentElement; element; element = element.parentElement) {
    saved.push([element, element.style.cssText]);
    element.style.height = FREED.height;
    element.style.overflow = FREED.overflow;
    if (element === document.documentElement || element === document.body) continue;
    element.style.minHeight = FREED.minHeight;
    element.style.flex = FREED.flex;
    element.style.width = FREED.width;
    if (getComputedStyle(element).position === "absolute") element.style.position = FREED.position;
  }
  window.scrollTo(0, 0);
  return () => {
    for (const [element, cssText] of saved) element.style.cssText = cssText;
    window.scrollTo(0, 0);
  };
}

export function PageScroll({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const page = useRef<ComponentRef<typeof View>>(null);
  useLayoutEffect(() => {
    const element = page.current as unknown as HTMLElement | null;
    return element ? freeAncestors(element) : undefined;
  }, []);
  return (
    <View ref={page} style={style} testID={testID}>
      {children}
    </View>
  );
}
