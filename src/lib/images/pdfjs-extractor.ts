import path from "node:path";
import { CtmTracker, placementRect, type Matrix } from "./ctm";
import type { PdfImageExtractor, PdfScan, RawImage } from "./ports";
import type { PageText, Placement } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- pdf.js ships no usable types for the legacy build */

/** pdf.js refuses to decode images with more pixels than this. */
const MAX_IMAGE_PIXELS = 40_000_000;
const OBJECT_TIMEOUT_MS = 5_000;
const LINE_Y_TOLERANCE = 3;
const GRAYSCALE_1BPP = 1;
const RGB_24BPP = 2;
const RGBA_32BPP = 3;

/** pdf.js decodes JPEG2000 / JBIG2 with wasm; the build bundled in unpdf strips those loaders, so we use pdfjs-dist. */
function wasmUrl(): string {
  return path.join(process.cwd(), "node_modules", "pdfjs-dist", "wasm").split(path.sep).join("/") + "/";
}

let pdfjsPromise: Promise<any> | null = null;

function loadPdfjs(): Promise<any> {
  pdfjsPromise ??= (async () => {
    // pdf.js evaluates `new DOMMatrix()` at import time; the layout never matters for operator lists.
    const g = globalThis as any;
    g.DOMMatrix ??= class DOMMatrix {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      constructor(m?: number[]) {
        if (Array.isArray(m) && m.length === 6) [this.a, this.b, this.c, this.d, this.e, this.f] = m;
      }
    };
    g.Path2D ??= class Path2D {};
    return import("pdfjs-dist/legacy/build/pdf.mjs");
  })();
  return pdfjsPromise;
}

function getObject(page: any, id: string): Promise<any | null> {
  const store = id.startsWith("g_") ? page.commonObjs : page.objs;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), OBJECT_TIMEOUT_MS);
    try {
      store.get(id, (obj: any) => {
        clearTimeout(timer);
        resolve(obj ?? null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Converts a pdf.js image object to 8-bit raw pixels, or null when it has no usable pixel data. */
export function toRawImage(obj: any): RawImage | null {
  const { width, height, data, kind } = obj ?? {};
  if (!data || !width || !height) return null;
  if (kind === GRAYSCALE_1BPP) {
    const rowBytes = Math.ceil(width / 8);
    if (data.length < rowBytes * height) return null;
    const gray = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) gray[y * width + x] = data[y * rowBytes + (x >> 3)] & (0x80 >> (x & 7)) ? 255 : 0;
    }
    return { width, height, channels: 1, data: gray };
  }
  const channels = kind === RGBA_32BPP ? 4 : kind === RGB_24BPP ? 3 : null;
  if (!channels || data.length < width * height * channels) return null;
  return { width, height, channels, data };
}

function textLines(items: any[], pageHeight: number): { text: string; y: number }[] {
  const rows: { y: number; parts: { x: number; str: string }[] }[] = [];
  for (const it of items) {
    const str = typeof it.str === "string" ? it.str : "";
    if (str.trim() === "") continue;
    const y = pageHeight - it.transform[5];
    const row = rows.find((r) => Math.abs(r.y - y) <= LINE_Y_TOLERANCE);
    if (row) row.parts.push({ x: it.transform[4], str });
    else rows.push({ y, parts: [{ x: it.transform[4], str }] });
  }
  return rows
    .sort((a, b) => a.y - b.y)
    .map((r) => ({ y: r.y, text: r.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(" ").replace(/\s+/g, " ").trim() }));
}

export const pdfjsExtractor: PdfImageExtractor = {
  async scan(pdf, { signal, maxPages }): Promise<PdfScan> {
    const pdfjs = await loadPdfjs();
    const OPS = pdfjs.OPS;
    const open = async () =>
      (
        await pdfjs.getDocument({
          data: new Uint8Array(pdf),
          isEvalSupported: false,
          maxImageSize: MAX_IMAGE_PIXELS,
          useSystemFonts: false,
          verbosity: 0,
          wasmUrl: wasmUrl(),
        }).promise
      );
    const doc = await open();

    const pageCount = Math.min(doc.numPages, maxPages);
    const pages: PageText[] = [];
    const placements: Placement[] = [];
    const inlineObjects = new Map<string, any>();

    for (let n = 1; n <= pageCount; n++) {
      signal.throwIfAborted();
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const pageSize = { width: viewport.width, height: viewport.height };
      const ops = await page.getOperatorList();
      const ctm = new CtmTracker();
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i];
        if (fn === OPS.save) ctm.save();
        else if (fn === OPS.restore) ctm.restore();
        else if (fn === OPS.transform) ctm.transform(args as Matrix);
        else if (fn === OPS.paintFormXObjectBegin) {
          ctm.save();
          if (args?.[0]) ctm.transform(args[0] as Matrix);
        } else if (fn === OPS.paintFormXObjectEnd) ctm.restore();
        else if (fn === OPS.paintImageXObject) {
          placements.push({
            page: n,
            opIndex: i,
            key: String(args[0]),
            bbox: placementRect(ctm.current, pageSize.height),
            pageSize,
            pxWidth: Number(args[1]) || 0,
            pxHeight: Number(args[2]) || 0,
          });
        } else if (fn === OPS.paintInlineImageXObject && args?.[0]) {
          const key = `inline_${n}_${i}`;
          inlineObjects.set(key, args[0]);
          placements.push({
            page: n,
            opIndex: i,
            key,
            bbox: placementRect(ctm.current, pageSize.height),
            pageSize,
            pxWidth: Number(args[0].width) || 0,
            pxHeight: Number(args[0].height) || 0,
          });
        }
      }
      const content = await page.getTextContent();
      pages.push({ page: n, lines: textLines(content.items, pageSize.height) });
      page.cleanup();
    }

    // pdf.js names images (`img_pN_k`, or `g_d0_...` once shared) depending on the pages processed before, and a
    // cleaned-up page never resolves its objects again. So pixels are decoded from a second document that walks the
    // pages in the same order as the scan (forward only, one page kept in memory). Callers decode in page order.
    await doc.destroy?.();
    let decodeDoc: any = null;
    let cursor = 0;
    let current: { n: number; page: any; ops: any } | null = null;

    async function pageFor(n: number): Promise<any> {
      if (current?.n === n) return current;
      current?.page.cleanup();
      current = null;
      if (!decodeDoc || n < cursor) {
        await decodeDoc?.destroy?.();
        decodeDoc = await open();
        cursor = 0;
      }
      while (cursor < n) {
        signal.throwIfAborted();
        cursor++;
        const page = await decodeDoc.getPage(cursor);
        const ops = await page.getOperatorList(); // resolves the page image objects
        if (cursor === n) current = { n, page, ops };
        else page.cleanup();
      }
      return current;
    }

    return {
      pageCount,
      pages,
      placements,
      async decode(p) {
        signal.throwIfAborted();
        const inline = inlineObjects.get(p.key);
        if (inline) return toRawImage(inline);
        const target = await pageFor(p.page);
        if (!target) return null;
        // Object ids depend on which pages were processed before; the operator index of the paint op does not.
        const key = target.ops.fnArray[p.opIndex] === OPS.paintImageXObject ? String(target.ops.argsArray[p.opIndex][0]) : p.key;
        return toRawImage(await getObject(target.page, key));
      },
      async close() {
        current?.page.cleanup();
        current = null;
        await decodeDoc?.destroy?.();
      },
    };
  },
};
