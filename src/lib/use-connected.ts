import { useConvexConnectionState } from "convex/react";

export function useConnected() {
  return useConvexConnectionState().isWebSocketConnected;
}
