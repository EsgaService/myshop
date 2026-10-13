import { describe, expect, it } from "vitest";
import { decideCover, decidePhotoChoice, type ImageRef } from "./decide-photo-choice";

const SELLER = "seller-a";
const OTHER = "seller-b";

const pdfImage = (over: Partial<ImageRef> = {}): ImageRef => ({
  id: "img-1",
  sellerId: SELLER,
  kind: "pdf",
  uploadId: "up-1",
  bookId: null,
  recipeId: null,
  ...over,
});

const customImage = (over: Partial<ImageRef> = {}): ImageRef => ({
  id: "img-9",
  sellerId: SELLER,
  kind: "custom",
  uploadId: null,
  bookId: "book-1",
  recipeId: "rec-1",
  ...over,
});

const recipe = { id: "rec-1", bookSellerId: SELLER };
const activeUploadIds = ["up-1", "up-2"];

describe("decidePhotoChoice (R3.3, R3.6)", () => {
  it("accepts a candidate of an active upload of the product", () => {
    expect(
      decidePhotoChoice({ sellerId: SELLER, recipe, activeUploadIds, choice: { type: "candidate", image: pdfImage() } }),
    ).toEqual({ ok: true, photoSource: "pdf", imageId: "img-1" });
  });

  it("rejects a candidate of an upload that is not active in this product", () => {
    expect(
      decidePhotoChoice({
        sellerId: SELLER,
        recipe,
        activeUploadIds,
        choice: { type: "candidate", image: pdfImage({ uploadId: "up-other-product" }) },
      }),
    ).toEqual({ ok: false, reason: "image_not_allowed" });
  });

  it("rejects an image owned by another seller", () => {
    expect(
      decidePhotoChoice({
        sellerId: SELLER,
        recipe,
        activeUploadIds,
        choice: { type: "candidate", image: pdfImage({ sellerId: OTHER }) },
      }),
    ).toEqual({ ok: false, reason: "image_not_allowed" });
  });

  it("rejects a missing image", () => {
    expect(
      decidePhotoChoice({ sellerId: SELLER, recipe, activeUploadIds, choice: { type: "candidate", image: null } }),
    ).toEqual({ ok: false, reason: "image_not_found" });
  });

  it("denies a recipe whose product belongs to another seller", () => {
    expect(
      decidePhotoChoice({
        sellerId: SELLER,
        recipe: { id: "rec-1", bookSellerId: OTHER },
        activeUploadIds,
        choice: { type: "candidate", image: pdfImage() },
      }),
    ).toEqual({ ok: false, reason: "not_owner" });
    expect(
      decidePhotoChoice({ sellerId: SELLER, recipe: { id: "rec-1", bookSellerId: OTHER }, activeUploadIds, choice: { type: "remove" } }),
    ).toEqual({ ok: false, reason: "not_owner" });
  });

  it("marks a removal as none so extraction does not refill it", () => {
    expect(decidePhotoChoice({ sellerId: SELLER, recipe, activeUploadIds, choice: { type: "remove" } })).toEqual({
      ok: true,
      photoSource: "none",
      imageId: null,
    });
  });

  it("accepts a custom image of this recipe and rejects one of another recipe or a pdf image", () => {
    expect(
      decidePhotoChoice({ sellerId: SELLER, recipe, activeUploadIds, choice: { type: "custom", image: customImage() } }),
    ).toEqual({ ok: true, photoSource: "custom", imageId: "img-9" });
    expect(
      decidePhotoChoice({
        sellerId: SELLER,
        recipe,
        activeUploadIds,
        choice: { type: "custom", image: customImage({ recipeId: "rec-2" }) },
      }),
    ).toEqual({ ok: false, reason: "image_not_allowed" });
    expect(
      decidePhotoChoice({ sellerId: SELLER, recipe, activeUploadIds, choice: { type: "custom", image: pdfImage() } }),
    ).toEqual({ ok: false, reason: "image_not_allowed" });
  });
});

describe("decideCover (R3.2, R3.6)", () => {
  const book = { id: "book-1", sellerId: SELLER };

  it("accepts a candidate from an active upload of the product", () => {
    expect(decideCover({ sellerId: SELLER, book, activeUploadIds, choice: { type: "candidate", image: pdfImage() } })).toEqual({
      ok: true,
      coverSource: "pdf",
      imageId: "img-1",
    });
  });

  it("rejects a candidate that belongs to an upload in another product", () => {
    expect(
      decideCover({
        sellerId: SELLER,
        book,
        activeUploadIds,
        choice: { type: "candidate", image: pdfImage({ uploadId: "up-in-product-b" }) },
      }),
    ).toEqual({ ok: false, reason: "image_not_allowed" });
  });

  it("accepts the sellers own upload for this product only", () => {
    const own = customImage({ recipeId: null });
    expect(decideCover({ sellerId: SELLER, book, activeUploadIds, choice: { type: "custom", image: own } })).toEqual({
      ok: true,
      coverSource: "custom",
      imageId: "img-9",
    });
    expect(
      decideCover({ sellerId: SELLER, book, activeUploadIds, choice: { type: "custom", image: { ...own, bookId: "book-2" } } }),
    ).toEqual({ ok: false, reason: "image_not_allowed" });
  });

  it("clears the cover as none, and denies a foreign product", () => {
    expect(decideCover({ sellerId: SELLER, book, activeUploadIds, choice: { type: "clear" } })).toEqual({
      ok: true,
      coverSource: "none",
      imageId: null,
    });
    expect(
      decideCover({ sellerId: SELLER, book: { id: "book-1", sellerId: OTHER }, activeUploadIds, choice: { type: "clear" } }),
    ).toEqual({ ok: false, reason: "not_owner" });
  });
});
