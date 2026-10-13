import { describe, expect, it } from "vitest";
import { describeRecipePhoto } from "./describe-recipe-photo";

describe("describeRecipePhoto", () => {
  it("shows the photo with its origin when there is one", () => {
    expect(describeRecipePhoto({ photoPath: "a/b.webp", photoSource: "auto" })).toEqual({ hasPhoto: true, label: "Detectada en tu PDF" });
    expect(describeRecipePhoto({ photoPath: "a/b.webp", photoSource: "pdf" })).toEqual({ hasPhoto: true, label: "Elegida de tu PDF" });
    expect(describeRecipePhoto({ photoPath: "a/b.webp", photoSource: "custom" })).toEqual({ hasPhoto: true, label: "Imagen propia" });
  });
  it("tells an unmatched recipe apart from a photo removed on purpose", () => {
    expect(describeRecipePhoto({ photoPath: null, photoSource: "auto" })).toEqual({ hasPhoto: false, label: "Sin foto: no encontramos una imagen" });
    expect(describeRecipePhoto({ photoPath: null, photoSource: "none" })).toEqual({ hasPhoto: false, label: "Sin foto (la quitaste)" });
  });
  it("treats a source with a missing path as no photo", () => {
    expect(describeRecipePhoto({ photoPath: null, photoSource: "custom" }).hasPhoto).toBe(false);
  });
});
