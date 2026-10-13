import { describe, expect, it, vi } from "vitest";
import { cleanupUploadImages, resetCoverIfFromUpload, uploadImagePrefix, type CleanupDeps } from "./cleanup";

const upload = { id: "up-1", sellerId: "sel-1", bookId: "book-1" };

function makeDeps(over: Partial<CleanupDeps> = {}) {
  const calls: string[] = [];
  const deps: CleanupDeps = {
    resetCoverUnderPrefix: async (bookId, prefix) => {
      calls.push(`cover:${bookId}:${prefix}`);
    },
    listImagePaths: async (uploadId) => {
      calls.push(`list:${uploadId}`);
      return ["sel-1/up-1/1.webp", "sel-1/up-1/1-t.webp"];
    },
    deleteImageRows: async (uploadId) => {
      calls.push(`rows:${uploadId}`);
    },
    removeObjects: async (paths) => {
      calls.push(`objects:${paths.join(",")}`);
    },
    ...over,
  };
  return { deps, calls };
}

describe("uploadImagePrefix", () => {
  it("is the folder that holds every image of an upload", () => {
    expect(uploadImagePrefix("sel-1", "up-1")).toBe("sel-1/up-1/");
  });
});

describe("cleanupUploadImages (R1.7, removal)", () => {
  it("nulls the cover that points to the upload, deletes rows, then removes the objects", async () => {
    const { deps, calls } = makeDeps();
    await cleanupUploadImages(upload, deps);
    expect(calls).toEqual([
      "cover:book-1:sel-1/up-1/",
      "list:up-1",
      "rows:up-1",
      "objects:sel-1/up-1/1.webp,sel-1/up-1/1-t.webp",
    ]);
  });

  it("skips the cover step for an upload without a product", async () => {
    const { deps, calls } = makeDeps();
    await cleanupUploadImages({ ...upload, bookId: null }, deps);
    expect(calls[0]).toBe("list:up-1");
  });

  it("does not call removeObjects when the upload has no images", async () => {
    const removeObjects = vi.fn();
    const { deps } = makeDeps({ listImagePaths: async () => [], removeObjects });
    await cleanupUploadImages(upload, deps);
    expect(removeObjects).not.toHaveBeenCalled();
  });

  it("is best effort: a failing step is logged and the rest still runs", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, calls } = makeDeps({
      resetCoverUnderPrefix: async () => {
        throw new Error("db down");
      },
    });
    await expect(cleanupUploadImages(upload, deps)).resolves.toBeUndefined();
    expect(calls).toEqual(["list:up-1", "rows:up-1", "objects:sel-1/up-1/1.webp,sel-1/up-1/1-t.webp"]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("resetCoverIfFromUpload (R1.7, move)", () => {
  it("only nulls the source cover that points to the moved upload; images stay", async () => {
    const { deps, calls } = makeDeps();
    await resetCoverIfFromUpload(upload, deps);
    expect(calls).toEqual(["cover:book-1:sel-1/up-1/"]);
  });

  it("does nothing without a source product", async () => {
    const { deps, calls } = makeDeps();
    await resetCoverIfFromUpload({ ...upload, bookId: null }, deps);
    expect(calls).toEqual([]);
  });
});
