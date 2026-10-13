import { describe, expect, it } from "vitest";
import { listMovablePdfs } from "./movable-pdfs";

const products = [
  { id: "a", title: "Cocteles" },
  { id: "b", title: "Micheladas" },
  { id: "c", title: "Postres" },
];

const upload = (id: string, book_id: string | null, status = "ready", created_at = "2026-01-01T00:00:00Z") => ({
  id,
  original_name: `${id}.pdf`,
  book_id,
  status,
  created_at,
});

describe("listMovablePdfs", () => {
  it("lists ready PDFs that live in other products, with their current product title", () => {
    const result = listMovablePdfs({
      targetBookId: "a",
      products,
      uploads: [upload("u1", "b"), upload("u2", "c")],
    });
    expect(result).toEqual([
      { id: "u1", name: "u1.pdf", productId: "b", productTitle: "Micheladas" },
      { id: "u2", name: "u2.pdf", productId: "c", productTitle: "Postres" },
    ]);
  });

  it("excludes PDFs already in the target product", () => {
    expect(listMovablePdfs({ targetBookId: "a", products, uploads: [upload("u1", "a")] })).toEqual([]);
  });

  it.each(["pending", "uploaded", "processing", "failed"])("excludes %s PDFs", (status) => {
    expect(listMovablePdfs({ targetBookId: "a", products, uploads: [upload("u1", "b", status)] })).toEqual([]);
  });

  it("excludes PDFs without a product or in a product that cannot be a source (legacy or unknown)", () => {
    const uploads = [upload("u1", null), upload("u2", "legacy")];
    expect(listMovablePdfs({ targetBookId: "a", products, uploads })).toEqual([]);
  });

  it("returns nothing when the target itself is not a valid destination", () => {
    expect(listMovablePdfs({ targetBookId: "legacy", products, uploads: [upload("u1", "b")] })).toEqual([]);
  });

  it("orders by product list order, then oldest upload first", () => {
    const result = listMovablePdfs({
      targetBookId: "c",
      products,
      uploads: [
        upload("late", "b", "ready", "2026-03-01T00:00:00Z"),
        upload("other", "a", "ready", "2026-02-01T00:00:00Z"),
        upload("early", "b", "ready", "2026-01-01T00:00:00Z"),
      ],
    });
    expect(result.map((r) => r.id)).toEqual(["other", "early", "late"]);
  });
});
