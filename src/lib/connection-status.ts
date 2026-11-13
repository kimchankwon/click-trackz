import type { ConnectionState } from "convex/browser";

export type ConnectionStatus = "online" | "connecting" | "offline";

export function connectionStatus(state: Pick<ConnectionState, "isWebSocketConnected" | "connectionRetries">): ConnectionStatus {
  if (state.isWebSocketConnected) return "online";
  return state.connectionRetries === 0 ? "connecting" : "offline";
}
