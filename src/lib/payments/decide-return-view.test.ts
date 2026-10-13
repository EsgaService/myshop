import { describe, expect, it } from "vitest";
import { decideReturnView } from "./decide-return-view";

describe("decideReturnView", () => {
  it("approved purchase links back to the book with no refresh", () => {
    expect(decideReturnView({ state: "approved", kind: "purchase" })).toMatchObject({ tone: "success", link: "book", autoRefresh: false });
  });

  it("approved subscription links to the subscription page", () => {
    expect(decideReturnView({ state: "approved", kind: "subscription" })).toMatchObject({ tone: "success", link: "subscription", autoRefresh: false });
  });

  it("pending keeps refreshing and still offers the way back", () => {
    expect(decideReturnView({ state: "pending", kind: "purchase" })).toMatchObject({ tone: "pending", autoRefresh: true, link: "book" });
    expect(decideReturnView({ state: "unavailable" })).toMatchObject({ tone: "pending", autoRefresh: true });
  });

  it("declined lets the user retry from the same place", () => {
    expect(decideReturnView({ state: "declined", kind: "subscription" })).toMatchObject({ tone: "danger", autoRefresh: false, link: "subscription" });
    expect(decideReturnView({ state: "declined", kind: "purchase" })).toMatchObject({ tone: "danger", link: "book" });
  });

  it("a problem asks the user to contact support and does not claim success", () => {
    const v = decideReturnView({ state: "problem", kind: "purchase" });
    expect(v.tone).toBe("danger");
    expect(v.message).toMatch(/soporte|contacta/i);
  });

  it("unfulfilled tells the user the payment is safe and support will sort it out, without claiming access", () => {
    const v = decideReturnView({ state: "unfulfilled", kind: "purchase" });
    expect(v.tone).toBe("danger");
    expect(v.autoRefresh).toBe(false);
    expect(v.message).toMatch(/reembolso|soporte/i);
  });

  it("unknown has no link and no refresh", () => {
    expect(decideReturnView({ state: "unknown" })).toMatchObject({ tone: "danger", link: "none", autoRefresh: false });
  });

  it("every view has a title and a message in Spanish copy", () => {
    for (const state of ["approved", "pending", "declined", "problem", "unfulfilled", "unknown", "unavailable"] as const) {
      const v = decideReturnView({ state, kind: "purchase" });
      expect(v.title.length).toBeGreaterThan(0);
      expect(v.message.length).toBeGreaterThan(0);
    }
  });
});
