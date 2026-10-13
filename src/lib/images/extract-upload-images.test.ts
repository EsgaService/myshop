import { describe, expect, it } from "vitest";
import { extractUploadImages, MAX_CANDIDATES_PER_UPLOAD } from "./extract-upload-images";
import type {
  CandidateRow,
  ImageEncoder,
  ImageStore,
  PdfImageExtractor,
  PdfScan,
  PhotoSource,
  RawImage,
  UploadRecipe,
} from "./ports";
import type { PageText, Placement } from "./types";
import type { CoverSource } from "./choose-cover";

const UPLOAD = { id: "up-1", sellerId: "sel-1", bookId: "book-1", storagePath: "sel-1/up-1.pdf" };
const PAGE = { width: 600, height: 800 };

function placement(opIndex: number, page: number, over: Partial<Placement> = {}): Placement {
  return {
    page,
    opIndex,
    key: `img_${opIndex}`,
    bbox: { x: 50, y: 100, w: 300, h: 300 },
    pageSize: PAGE,
    pxWidth: 900,
    pxHeight: 900,
    ...over,
  };
}

const text = (page: number, line: string): PageText => ({ page, lines: [{ text: line, y: 60 }] });

type Fixture = {
  placements: Placement[];
  pages: PageText[];
  undecodable?: number[]; // opIndex values
  scanError?: Error;
  decodeError?: Error;
  recipes?: UploadRecipe[];
  cover?: { coverUrl: string | null; coverSource: CoverSource };
  /** What the DB says about the upload right before writing (default: active, same product). */
  uploadState?: { bookId: string | null; removedAt: string | null } | null;
};

const raw: RawImage = { width: 4, height: 4, channels: 3, data: new Uint8Array(48) };

function makeWorld(fx: Fixture) {
  const calls: string[] = [];
  const objects = new Map<string, Uint8Array>();
  let candidates: CandidateRow[] = [];
  let recipePhotos: { recipeId: string; sourcePage: number; photoPath?: string }[] = [];
  let cover: string | null = null;
  let done: boolean | null = null;
  let failed: string | null = null;
  let closed = false;

  const scan: PdfScan = {
    pageCount: Math.max(0, ...fx.pages.map((p) => p.page)),
    pages: fx.pages,
    placements: fx.placements,
    async decode(p) {
      if (fx.decodeError) throw fx.decodeError;
      return fx.undecodable?.includes(p.opIndex) ? null : raw;
    },
    async close() {
      closed = true;
    },
  };
  const extractor: PdfImageExtractor = {
    async scan() {
      if (fx.scanError) throw fx.scanError;
      return scan;
    },
  };
  const encoder: ImageEncoder = {
    async toWebp() {
      return { full: new Uint8Array([1, 1]), thumb: new Uint8Array([2]), width: 1600, height: 1200 };
    },
  };
  const store: ImageStore = {
    async downloadPdf() {
      calls.push("download");
      return new Uint8Array([37]);
    },
    async listUploadRecipes() {
      return fx.recipes ?? [];
    },
    async getBookCover() {
      return fx.cover ?? { coverUrl: null, coverSource: "auto" };
    },
    async putImage(path, bytes) {
      objects.set(path, bytes);
    },
    async getUploadState() {
      return fx.uploadState === undefined ? { bookId: UPLOAD.bookId, removedAt: null } : fx.uploadState;
    },
    async replaceCandidates(_upload, rows) {
      candidates = rows;
    },
    async setRecipePhotos(updates) {
      recipePhotos = updates;
    },
    async setCover(_bookId, path) {
      cover = path;
    },
    async markDone(_id, reviewPending) {
      done = reviewPending;
    },
    async markFailed(_id, message) {
      failed = message;
    },
  };

  const run = () => extractUploadImages(UPLOAD, { extractor, encoder, store, signal: new AbortController().signal });
  return {
    run,
    state: () => ({ calls, objects, candidates, recipePhotos, cover, done, failed, closed }),
  };
}

const recipe = (id: string, title: string, photoSource: PhotoSource = "auto"): UploadRecipe => ({ id, title, photoSource });

const twoRecipePdf = (): Fixture => ({
  pages: [text(1, "Portada"), text(2, "Margarita Clásica"), text(3, "Mojito")],
  placements: [placement(1, 1, { bbox: { x: 0, y: 0, w: 600, h: 800 } }), placement(2, 2), placement(3, 3)],
  recipes: [recipe("r1", "Margarita Clásica"), recipe("r2", "Mojito")],
});

describe("extractUploadImages (R1.1, R1.5, R1.6)", () => {
  it("stores candidates, assigns photos to recipes, picks a cover and marks done", async () => {
    const w = makeWorld(twoRecipePdf());
    const result = await w.run();
    const s = w.state();

    expect(result).toEqual({ status: "done", stored: 3 });
    expect(s.candidates.map((c) => [c.ordinal, c.page, c.storagePath, c.thumbPath])).toEqual([
      [1, 1, "sel-1/up-1/1.webp", "sel-1/up-1/1-t.webp"],
      [2, 2, "sel-1/up-1/2.webp", "sel-1/up-1/2-t.webp"],
      [3, 3, "sel-1/up-1/3.webp", "sel-1/up-1/3-t.webp"],
    ]);
    expect([...s.objects.keys()].sort()).toEqual([
      "sel-1/up-1/1-t.webp",
      "sel-1/up-1/1.webp",
      "sel-1/up-1/2-t.webp",
      "sel-1/up-1/2.webp",
      "sel-1/up-1/3-t.webp",
      "sel-1/up-1/3.webp",
    ]);
    expect(s.recipePhotos).toEqual([
      { recipeId: "r1", sourcePage: 2, photoPath: "sel-1/up-1/2.webp" },
      { recipeId: "r2", sourcePage: 3, photoPath: "sel-1/up-1/3.webp" },
    ]);
    expect(s.cover).toBe("sel-1/up-1/1.webp"); // full-page photo on page 1 is the cover
    expect(s.done).toBe(true);
    expect(s.failed).toBeNull();
    expect(s.closed).toBe(true);
  });

  it("is idempotent: a second run produces the same rows, paths and photos", async () => {
    const w = makeWorld(twoRecipePdf());
    await w.run();
    const first = JSON.stringify([w.state().candidates, w.state().recipePhotos, [...w.state().objects.keys()].sort()]);
    await w.run();
    const second = JSON.stringify([w.state().candidates, w.state().recipePhotos, [...w.state().objects.keys()].sort()]);
    expect(second).toBe(first);
    expect(w.state().candidates).toHaveLength(3);
  });

  it("does not store or offer background images", async () => {
    const fx = twoRecipePdf();
    fx.placements.push(placement(9, 2, { bbox: { x: 0, y: 0, w: 60, h: 60 } })); // too small: decoration
    const w = makeWorld(fx);
    await w.run();
    expect(w.state().candidates.map((c) => c.ordinal)).toEqual([1, 2, 3]);
  });

  it("skips undecodable images and keeps the rest", async () => {
    const fx = twoRecipePdf();
    fx.undecodable = [2]; // Margarita's image cannot be decoded
    const w = makeWorld(fx);
    const result = await w.run();
    const s = w.state();
    expect(result).toEqual({ status: "done", stored: 2 });
    expect(s.candidates.map((c) => c.ordinal)).toEqual([1, 3]);
    expect(s.recipePhotos).toEqual([
      { recipeId: "r1", sourcePage: 2 },
      { recipeId: "r2", sourcePage: 3, photoPath: "sel-1/up-1/3.webp" },
    ]);
  });

  it("marks done without review when the PDF has no usable images", async () => {
    const w = makeWorld({ pages: [text(1, "Solo texto")], placements: [], recipes: [recipe("r1", "Mojito")] });
    const result = await w.run();
    expect(result).toEqual({ status: "done", stored: 0 });
    expect(w.state().done).toBe(false);
    expect(w.state().candidates).toEqual([]);
  });

  it("leaves recipes without photo when the PDF has no text layer", async () => {
    const w = makeWorld({ pages: [], placements: [placement(1, 2)], recipes: [recipe("r1", "Mojito")] });
    await w.run();
    expect(w.state().recipePhotos).toEqual([]);
    expect(w.state().candidates).toHaveLength(1);
  });
});

describe("extractUploadImages respects seller choices (R3.4)", () => {
  it("never touches recipes that are not auto", async () => {
    const fx = twoRecipePdf();
    fx.recipes = [recipe("r1", "Margarita Clásica", "custom"), recipe("r2", "Mojito", "none")];
    const w = makeWorld(fx);
    await w.run();
    expect(w.state().recipePhotos).toEqual([]);
    expect(w.state().candidates).toHaveLength(3); // candidates are still offered to the seller
  });

  it("keeps an existing or seller-chosen cover", async () => {
    const withUrl = makeWorld({ ...twoRecipePdf(), cover: { coverUrl: "sel-1/cover.webp", coverSource: "auto" } });
    await withUrl.run();
    expect(withUrl.state().cover).toBeNull();

    const cleared = makeWorld({ ...twoRecipePdf(), cover: { coverUrl: null, coverSource: "none" } });
    await cleared.run();
    expect(cleared.state().cover).toBeNull();
  });
});

describe("extractUploadImages never fails the book (R1.2)", () => {
  it("records the failure when the scan throws, writes nothing else and does not throw", async () => {
    const w = makeWorld({ ...twoRecipePdf(), scanError: new Error("bad xref") });
    const result = await w.run();
    const s = w.state();
    expect(result).toEqual({ status: "failed", error: "bad xref" });
    expect(s.failed).toBe("bad xref");
    expect(s.done).toBeNull();
    expect(s.candidates).toEqual([]);
    expect(s.recipePhotos).toEqual([]);
    expect(s.cover).toBeNull();
  });

  it("records the failure when decoding throws and still closes the scan", async () => {
    const w = makeWorld({ ...twoRecipePdf(), decodeError: new Error("out of memory") });
    const result = await w.run();
    expect(result).toEqual({ status: "failed", error: "out of memory" });
    expect(w.state().failed).toBe("out of memory");
    expect(w.state().done).toBeNull();
    expect(w.state().closed).toBe(true);
  });

  it("fails when the time budget signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const calls: string[] = [];
    let failedWith: string | null = null;
    const result = await extractUploadImages(UPLOAD, {
      extractor: { scan: async () => ({ pageCount: 1, pages: [], placements: [placement(1, 1)], decode: async () => raw, close: async () => {} }) },
      encoder: { toWebp: async () => ({ full: new Uint8Array([1]), thumb: new Uint8Array([2]), width: 1, height: 1 }) },
      store: {
        downloadPdf: async () => {
          calls.push("download");
          return new Uint8Array();
        },
        listUploadRecipes: async () => [],
        getBookCover: async () => ({ coverUrl: null, coverSource: "auto" }),
        getUploadState: async () => ({ bookId: UPLOAD.bookId, removedAt: null }),
        putImage: async () => {},
        replaceCandidates: async () => {},
        setRecipePhotos: async () => {},
        setCover: async () => {},
        markDone: async () => {},
        markFailed: async (_id, message) => {
          failedWith = message;
        },
      },
      signal: controller.signal,
    });
    expect(result.status).toBe("failed");
    expect(calls).toEqual([]); // aborted before any download
    expect(failedWith).toContain("abort");
  });
});

describe("extractUploadImages vs removal or move while it runs", () => {
  it.each([
    ["removed", { bookId: "book-1", removedAt: "2026-10-12T00:00:00Z" }],
    ["moved to another product", { bookId: "book-2", removedAt: null }],
    ["deleted", null],
  ])("writes nothing when the upload was %s", async (_label, uploadState) => {
    const w = makeWorld({ ...twoRecipePdf(), uploadState });
    const result = await w.run();
    const s = w.state();
    expect(result).toEqual({ status: "done", stored: 0 });
    expect(s.candidates).toEqual([]);
    expect(s.recipePhotos).toEqual([]);
    expect(s.cover).toBeNull();
    expect(s.done).toBeNull();
    expect(s.failed).toBeNull();
  });
});

describe("extractUploadImages caps candidates", () => {
  it("stores at most the cap, keeping assigned photos", async () => {
    const many: Placement[] = [];
    for (let i = 1; i <= MAX_CANDIDATES_PER_UPLOAD + 20; i++) many.push(placement(i, 10 + (i % 40), { key: `k${i}` }));
    // The recipe's own photo is the smallest image of the page: it must survive the cap anyway.
    many.push(placement(500, 2, { key: "mine", bbox: { x: 0, y: 0, w: 120, h: 120 } }));
    const w = makeWorld({ pages: [text(2, "Mojito")], placements: many, recipes: [recipe("r1", "Mojito")] });
    const result = await w.run();
    expect(result).toEqual({ status: "done", stored: MAX_CANDIDATES_PER_UPLOAD });
    expect(w.state().candidates).toHaveLength(MAX_CANDIDATES_PER_UPLOAD);
    expect(w.state().recipePhotos).toHaveLength(1);
    expect(w.state().recipePhotos[0].photoPath).toBeDefined();
  });
});
