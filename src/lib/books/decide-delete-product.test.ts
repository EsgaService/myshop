import { describe, expect, it } from "vitest";
import { decideDeleteProduct, deleteProductErrorMessage } from "./decide-delete-product";

const empty = { status: "draft" as const, hasPurchases: false, activeUploadCount: 0 };

describe("decideDeleteProduct (R5.2)", () => {
  it("allows deleting an empty draft without purchases", () => {
    expect(decideDeleteProduct(empty)).toEqual({ ok: true });
  });

  it("refuses a draft that still has active PDFs", () => {
    expect(decideDeleteProduct({ ...empty, activeUploadCount: 1 })).toEqual({ ok: false, reason: "has_pdfs" });
  });

  it("refuses published products", () => {
    expect(decideDeleteProduct({ ...empty, status: "published" })).toEqual({ ok: false, reason: "published" });
  });

  it("refuses archived products", () => {
    expect(decideDeleteProduct({ ...empty, status: "archived" })).toEqual({ ok: false, reason: "archived" });
  });

  it("never deletes a book that has purchases, whatever its other state", () => {
    expect(decideDeleteProduct({ ...empty, hasPurchases: true })).toEqual({ ok: false, reason: "sold" });
    expect(decideDeleteProduct({ status: "published", hasPurchases: true, activeUploadCount: 2 })).toEqual({
      ok: false,
      reason: "sold",
    });
  });
});

describe("deleteProductErrorMessage", () => {
  it("returns Spanish copy per reason", () => {
    expect(deleteProductErrorMessage("has_pdfs")).toMatch(/PDF/);
    expect(deleteProductErrorMessage("sold")).toMatch(/compras/);
    expect(deleteProductErrorMessage("published")).toMatch(/publicado/);
    expect(deleteProductErrorMessage("archived")).toMatch(/archivado/);
  });
});
