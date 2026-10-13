import { describe, expect, it } from "vitest";
import { toPreviewCard } from "./preview-card";

const base = {
  title: "Cócteles de la casa",
  tagline: "Veinte clásicos",
  sellerName: "Mi tienda",
  priceCents: 2500000,
  currency: "COP",
  primaryColor: "#111111",
  backgroundColor: "#ffffff",
  textColor: "#222222",
};

describe("toPreviewCard", () => {
  it("maps the live form values and resolves the cover", () => {
    const card = toPreviewCard({ ...base, coverUrl: "https://x.test/c.webp" });
    expect(card.title).toBe("Cócteles de la casa");
    expect(card.coverUrl).toBe("https://x.test/c.webp");
    expect(card.href).toBe("#");
  });
  it("uses a neutral title and no tagline while the fields are blank", () => {
    const card = toPreviewCard({ ...base, title: "   ", tagline: " ", coverUrl: null });
    expect(card.title).toBe("Título de tu recetario");
    expect(card.tagline).toBeNull();
    expect(card.coverUrl).toBeNull();
  });
  it("drops cover values that are not safe image sources", () => {
    expect(toPreviewCard({ ...base, coverUrl: "javascript:alert(1)" }).coverUrl).toBeNull();
  });
});
