import { describe, expect, it } from "vitest";

import { connectionStatus } from "./connection-status";

describe("connectionStatus", () => {
  it("is online while the socket is open", () => {
    expect(connectionStatus({ isWebSocketConnected: true, connectionRetries: 0 })).toBe("online");
  });

  it("is connecting during the first try", () => {
    expect(connectionStatus({ isWebSocketConnected: false, connectionRetries: 0 })).toBe("connecting");
  });

  it("is offline once a try has failed", () => {
    expect(connectionStatus({ isWebSocketConnected: false, connectionRetries: 3 })).toBe("offline");
  });
});
