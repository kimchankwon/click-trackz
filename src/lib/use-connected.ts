import { useConvexConnectionState } from "convex/react";

import { useBrowserOnline } from "./browser-online";
import { connectionStatus } from "./connection-status";

export function useConnected() {
  const online = useBrowserOnline();
  return useConvexConnectionState().isWebSocketConnected && online;
}

export function useConnectionStatus() {
  const online = useBrowserOnline();
  const status = connectionStatus(useConvexConnectionState());
  return online || status !== "online" ? status : "offline";
}
