import { describe, expect, it } from "vitest";
import { parseBuyerProfile } from "./profile-schema";

describe("parseBuyerProfile (R16)", () => {
  it("accepts a valid profile and trims values", () => {
    expect(parseBuyerProfile({ displayName: "  Ana Pérez ", phone: "+57 300 123 4567", city: " Medellín " })).toEqual({
      ok: true,
      value: { display_name: "Ana Pérez", phone: "+57 300 123 4567", city: "Medellín" },
    });
  });

  it("turns empty optional fields into null", () => {
    expect(parseBuyerProfile({ displayName: "Ana", phone: "", city: "  " })).toEqual({
      ok: true,
      value: { display_name: "Ana", phone: null, city: null },
    });
  });

  it("requires a display name", () => {
    const r = parseBuyerProfile({ displayName: "   ", phone: "", city: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.displayName).toBeTruthy();
  });

  it("rejects an oversized name, a malformed phone and a long city", () => {
    const r = parseBuyerProfile({ displayName: "x".repeat(81), phone: "abc", city: "y".repeat(81) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["city", "displayName", "phone"]);
  });

  it("ignores unexpected fields such as role", () => {
    const r = parseBuyerProfile({ displayName: "Ana", phone: "", city: "", role: "seller" });
    expect(r).toEqual({ ok: true, value: { display_name: "Ana", phone: null, city: null } });
  });

  it("treats non-string input as missing", () => {
    expect(parseBuyerProfile({ displayName: 5, phone: null, city: undefined }).ok).toBe(false);
  });
});
