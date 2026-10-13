import { describe, expect, it } from "vitest";
import { labels } from "../src/lib/labels";
import { mediaPeers } from "../src/lib/peers";

describe("computer players in the client", () => {
  it("leaves computer players out of the video mesh: they have no socket to answer", () => {
    const players = [
      { id: "a", isBot: false },
      { id: "bot", isBot: true },
      { id: "b", isBot: false },
    ];
    expect(mediaPeers(players)).toEqual(["a", "b"]);
  });

  it("says a computer is a computer", () => {
    expect(labels.turnOfBot("Ordi Trèfle")).toBe("Tour d'Ordi Trèfle, l'ordinateur");
    expect(labels.botTag).toBe("ordi");
    expect(labels.removeBot("Ordi Pique")).toBe("Retirer Ordi Pique");
    expect(labels.soloOpponents(1)).toBe("1 ordinateur");
    expect(labels.soloOpponents(3)).toBe("3 ordinateurs");
  });

  it("shortens a computer's name on its seat, where the ordi tag already says what it is", () => {
    expect(labels.botShortName("Ordi Trèfle")).toBe("Trèfle");
    expect(labels.botShortName("Ordi Joker")).toBe("Joker");
    expect(labels.botShortName("Robot")).toBe("Robot");
  });
});
