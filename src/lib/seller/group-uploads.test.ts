import { describe, expect, it } from "vitest";
import { groupUploadsByProduct } from "./group-uploads";

const book = (id: string) => ({ id });
const up = (id: string, book_id: string | null, created_at: string) => ({ id, book_id, created_at });

describe("groupUploadsByProduct (R1.2, R6.2)", () => {
  it("groups uploads under their product in upload order (oldest first)", () => {
    const result = groupUploadsByProduct(
      [book("b1"), book("b2")],
      [
        up("u3", "b1", "2026-10-12T10:03:00Z"),
        up("u1", "b1", "2026-10-12T10:01:00Z"),
        up("u2", "b2", "2026-10-12T10:02:00Z"),
        up("u4", "b1", "2026-10-12T10:02:30Z"),
      ],
    );
    expect(result.groups.map((g) => [g.book.id, g.uploads.map((u) => u.id)])).toEqual([
      ["b1", ["u1", "u4", "u3"]],
      ["b2", ["u2"]],
    ]);
    expect(result.orphans).toEqual([]);
  });

  it("keeps products without PDFs as empty groups, in the given product order", () => {
    const result = groupUploadsByProduct([book("b2"), book("b1")], [up("u1", "b1", "2026-10-12T10:01:00Z")]);
    expect(result.groups.map((g) => [g.book.id, g.uploads.length])).toEqual([
      ["b2", 0],
      ["b1", 1],
    ]);
  });

  it("puts uploads without a product, or with an unknown one, in the orphan group", () => {
    const result = groupUploadsByProduct(
      [book("b1")],
      [up("u1", null, "2026-10-12T10:02:00Z"), up("u2", "ghost", "2026-10-12T10:01:00Z"), up("u3", "b1", "2026-10-12T10:03:00Z")],
    );
    expect(result.orphans.map((u) => u.id)).toEqual(["u2", "u1"]);
    expect(result.groups[0]!.uploads.map((u) => u.id)).toEqual(["u3"]);
  });
});
