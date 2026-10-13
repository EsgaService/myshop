import { describe, expect, it } from "vitest";
import { pickTeaserPhotoPath } from "./teaser-photo";

const rows = [
  { title: "Margarita", photo_path: "s/u/1.webp" },
  { title: "Mojito Clásico", photo_path: null },
  { title: "Piña Colada", photo_path: "s/u/3.webp" },
];

describe("pickTeaserPhotoPath", () => {
  it("returns null without a sample title", () => {
    expect(pickTeaserPhotoPath(rows, undefined)).toBeNull();
    expect(pickTeaserPhotoPath(rows, "")).toBeNull();
  });

  it("matches the sample title ignoring case, accents and spacing", () => {
    expect(pickTeaserPhotoPath(rows, "  PINA colada ")).toBe("s/u/3.webp");
    expect(pickTeaserPhotoPath(rows, "margarita")).toBe("s/u/1.webp");
  });

  it("returns null when the matching recipe has no photo", () => {
    expect(pickTeaserPhotoPath(rows, "Mojito Clásico")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(pickTeaserPhotoPath(rows, "Daiquiri")).toBeNull();
  });

  it("skips duplicates without photo and uses the first one that has it", () => {
    const dup = [
      { title: "Margarita", photo_path: null },
      { title: "Margarita", photo_path: "a.webp" },
    ];
    expect(pickTeaserPhotoPath(dup, "Margarita")).toBe("a.webp");
  });
});
