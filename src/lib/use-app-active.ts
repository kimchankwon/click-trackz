import { useSyncExternalStore } from "react";
import { AppState } from "react-native";

const subscribe = (onChange: () => void) => {
  const subscription = AppState.addEventListener("change", onChange);
  return () => subscription.remove();
};

const isActive = () => AppState.currentState === "active";

export function useAppActive(): boolean {
  return useSyncExternalStore(subscribe, isActive);
}
