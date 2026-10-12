import { describe, expect, it } from "vitest";
import { isTransportError, settle } from "../src/lib/requestError";

describe("request outcome", () => {
  it("returns the server's response", () => {
    expect(settle(null, { roomId: "ABCDE" })).toEqual({ roomId: "ABCDE" });
  });

  it("marks a timeout or a dropped socket as a transport failure, not a verdict", () => {
    // What socket.io-client passes to a timed-out ack, and to every pending ack on disconnect.
    for (const err of [new Error("operation has timed out"), new Error("socket has been disconnected")]) {
      let caught: unknown;
      try {
        settle(err, undefined);
      } catch (e) {
        caught = e;
      }
      expect(isTransportError(caught)).toBe(true);
    }
  });

  it("keeps a server refusal as a verdict, with its message", () => {
    let caught: unknown;
    try {
      settle(null, { error: "Session invalide" });
    } catch (e) {
      caught = e;
    }
    expect(isTransportError(caught)).toBe(false);
    expect((caught as Error).message).toBe("Session invalide");
  });
});
