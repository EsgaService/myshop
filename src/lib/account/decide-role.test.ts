import { describe, expect, it } from "vitest";
import { decideRole } from "./decide-role";

describe("decideRole (R1)", () => {
  it("assigns seller to a new user coming from the seller screen", () => {
    expect(decideRole({ existingRole: null, intent: "seller", hasLegacyPurchases: false })).toEqual({
      role: "seller",
      isNew: true,
      mismatch: false,
    });
  });

  it("assigns buyer to a new user coming from the buyer screen", () => {
    expect(decideRole({ existingRole: null, intent: "buyer", hasLegacyPurchases: false })).toEqual({
      role: "buyer",
      isNew: true,
      mismatch: false,
    });
  });

  it("defaults to buyer when the intent is missing or forged", () => {
    for (const intent of [null, undefined, "", "admin", "SELLER", "seller ", "1"]) {
      expect(decideRole({ existingRole: null, intent, hasLegacyPurchases: false }).role).toBe("buyer");
    }
  });

  it("never changes an existing buyer who uses the seller screen, and flags the mismatch", () => {
    expect(decideRole({ existingRole: "buyer", intent: "seller", hasLegacyPurchases: false })).toEqual({
      role: "buyer",
      isNew: false,
      mismatch: true,
    });
  });

  it("keeps an existing seller who uses the buyer screen, and flags the mismatch", () => {
    expect(decideRole({ existingRole: "seller", intent: "buyer", hasLegacyPurchases: false })).toEqual({
      role: "seller",
      isNew: false,
      mismatch: true,
    });
  });

  it("reports no mismatch when the existing role matches or the intent is unknown", () => {
    expect(decideRole({ existingRole: "seller", intent: "seller", hasLegacyPurchases: false }).mismatch).toBe(false);
    expect(decideRole({ existingRole: "buyer", intent: "forged", hasLegacyPurchases: false }).mismatch).toBe(false);
  });

  it("forces buyer for a new profile of a legacy purchaser, even with seller intent", () => {
    expect(decideRole({ existingRole: null, intent: "seller", hasLegacyPurchases: true })).toEqual({
      role: "buyer",
      isNew: true,
      mismatch: true,
    });
  });

  it("ignores legacy purchases once a role exists", () => {
    expect(decideRole({ existingRole: "seller", intent: "seller", hasLegacyPurchases: true }).role).toBe("seller");
  });
});
