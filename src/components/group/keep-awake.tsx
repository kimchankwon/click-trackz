import { useKeepAwake } from "expo-keep-awake";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

function ScreenWakeLock() {
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });
  return null;
}

export function KeepAwake() {
  const [returns, setReturns] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setReturns((count) => count + 1);
    });
    return () => subscription.remove();
  }, []);
  return <ScreenWakeLock key={returns} />;
}
