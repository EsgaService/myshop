import { describe, expect, it } from "vitest";
import { parseSellerProfile } from "./profile-schema";

const base = { storeName: "Dulces de Ana", slug: "dulces-de-ana", bio: "", city: "", instagram: "", whatsapp: "" };

describe("parseSellerProfile (R4)", () => {
  it("accepts a minimal profile and nulls the optional fields", () => {
    expect(parseSellerProfile(base)).toEqual({
      ok: true,
      value: { store_name: "Dulces de Ana", slug: "dulces-de-ana", bio: null, city: null, instagram: null, whatsapp: null },
    });
  });

  it("requires a store name", () => {
    const r = parseSellerProfile({ ...base, storeName: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.storeName).toBeTruthy();
  });

  it("rejects store names over 80 characters", () => {
    const r = parseSellerProfile({ ...base, storeName: "x".repeat(81) });
    expect(r.ok).toBe(false);
  });

  it("normalizes the slug to lowercase and trims it", () => {
    const r = parseSellerProfile({ ...base, slug: "  Dulces-Ana " });
    expect(r.ok && r.value.slug).toBe("dulces-ana");
  });

  it.each(["has space", "ñandú", "-start", "end-", "double--dash", "a/b", ""])("rejects malformed slug %j", (slug) => {
    const r = parseSellerProfile({ ...base, slug });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.slug).toBeTruthy();
  });

  it.each(["api", "vendedor", "explorar", "mis-recetarios", "myshop", "cocteles"])("rejects reserved slug %s", (slug) => {
    const r = parseSellerProfile({ ...base, slug });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.slug).toMatch(/disponible/);
  });

  it("rejects slugs over 40 characters", () => {
    expect(parseSellerProfile({ ...base, slug: "a".repeat(41) }).ok).toBe(false);
  });

  it("strips a leading @ from instagram and validates the handle", () => {
    const ok = parseSellerProfile({ ...base, instagram: "@dulces.ana" });
    expect(ok.ok && ok.value.instagram).toBe("dulces.ana");
    expect(parseSellerProfile({ ...base, instagram: "not a handle!" }).ok).toBe(false);
  });

  it("validates whatsapp like a phone number", () => {
    const ok = parseSellerProfile({ ...base, whatsapp: "+57 300 123 4567" });
    expect(ok.ok && ok.value.whatsapp).toBe("+57 300 123 4567");
    expect(parseSellerProfile({ ...base, whatsapp: "abc" }).ok).toBe(false);
  });

  it("limits bio and city length", () => {
    expect(parseSellerProfile({ ...base, bio: "x".repeat(501) }).ok).toBe(false);
    expect(parseSellerProfile({ ...base, city: "x".repeat(81) }).ok).toBe(false);
  });

  it("only returns known fields: nothing else (id, user_id, is_platform) can be smuggled in", () => {
    const r = parseSellerProfile({ ...base, is_platform: true, user_id: "x", id: "y" });
    expect(r.ok && Object.keys(r.value).sort()).toEqual(["bio", "city", "instagram", "slug", "store_name", "whatsapp"]);
  });
});
