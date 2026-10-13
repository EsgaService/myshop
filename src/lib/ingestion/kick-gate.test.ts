import { describe, expect, it } from "vitest";
import { createKickGate } from "./kick-gate";

describe("createKickGate", () => {
  it("lets the first kick through and blocks the rest of the window", () => {
    let t = 1_000;
    const gate = createKickGate(30_000, () => t);
    expect(gate.tryAcquire()).toBe(true);
    t += 29_999;
    expect(gate.tryAcquire()).toBe(false);
    expect(gate.tryAcquire()).toBe(false);
  });

  it("opens again once the window elapsed", () => {
    let t = 0;
    const gate = createKickGate(30_000, () => t);
    expect(gate.tryAcquire()).toBe(true);
    t = 30_000;
    expect(gate.tryAcquire()).toBe(true);
    expect(gate.tryAcquire()).toBe(false);
  });
});
