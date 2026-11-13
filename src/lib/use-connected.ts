import { useConvexConnectionState } from "convex/react";

import { connectionStatus } from "./connection-status";

export function useConnected() {
  return useConvexConnectionState().isWebSocketConnected;
}

export function useConnectionStatus() {
  return connectionStatus(useConvexConnectionState());
}
