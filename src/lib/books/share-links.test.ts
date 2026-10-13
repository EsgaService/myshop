import { describe, expect, it } from "vitest";
import { absoluteUrl, bookPaths, storePath } from "./share-links";

describe("share links (R5)", () => {
  it("builds seller store and book paths", () => {
    expect(storePath("ana")).toBe("/ana");
    expect(bookPaths("ana", "tacos")).toEqual({
      landing: "/ana/tacos",
      checkout: "/ana/tacos/pagar",
      book: "/ana/tacos/recetario",
    });
  });

  it("builds absolute URLs without double slashes", () => {
    expect(absoluteUrl("/ana/tacos", "https://myshop.co")).toBe("https://myshop.co/ana/tacos");
    expect(absoluteUrl("/ana/tacos", "https://myshop.co/")).toBe("https://myshop.co/ana/tacos");
    expect(absoluteUrl("ana", "http://localhost:4000")).toBe("http://localhost:4000/ana");
  });
});
