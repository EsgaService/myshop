import { describe, expect, it } from "vitest";
import { toBookCard } from "./to-card";
import type { BookWithSeller } from "@/lib/data/types";

const book = {
  id: "b1",
  seller_id: "s1",
  slug: "cocteles",
  title: "Cócteles",
  tagline: "Clásicos",
  description: null,
  cover_url: null,
  primary_color: "#111111",
  secondary_color: "#222222",
  background_color: "#ffffff",
  text_color: "#000000",
  font: "Inter",
  price_cents: 1990000,
  currency: "COP",
  teaser: {},
  status: "published",
  published_at: null,
  seller: { id: "s1", slug: "myshop", store_name: "MyShop", is_platform: true },
} satisfies BookWithSeller;

describe("toBookCard", () => {
  it("links to the public product page /<seller>/<book>", () => {
    expect(toBookCard(book).href).toBe("/myshop/cocteles");
  });

  it("carries seller name, price and branding colors", () => {
    expect(toBookCard(book)).toMatchObject({
      title: "Cócteles",
      tagline: "Clásicos",
      sellerName: "MyShop",
      priceCents: 1990000,
      currency: "COP",
      primaryColor: "#111111",
      backgroundColor: "#ffffff",
      textColor: "#000000",
    });
  });
});
