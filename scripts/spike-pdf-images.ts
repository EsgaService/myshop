/**
 * Feasibility spike for PDF image extraction (change: pdf-images).
 *
 *   npx tsx scripts/spike-pdf-images.ts "<pdf or dir>" [more paths...]
 *
 * Per PDF it reports: wall time, pages, image placements found, how many
 * decode, how many survive a simple background filter, and a proxy for the
 * recipe-title match rate (pages with a heading-like line that also carry a
 * non-background image). Local only: never run in CI, never commit the PDFs.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// JPEG2000 / JBIG2 images need the pdf.js wasm decoders (pdfjs-dist ships them).
const WASM_URL = path.resolve("node_modules/pdfjs-dist/wasm").split(path.sep).join("/") + "/";

// The pdf.js build bundled in unpdf strips the wasm loaders (JPX/JBIG2 images
// come back null), so we use pdfjs-dist directly with minimal DOM polyfills.
async function loadPdfjs(): Promise<any> {
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
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function mul(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

type Placement = { page: number; objId: string; w: number; h: number; areaRatio: number; minSide: number; aspect: number };

function listPdfs(inputs: string[]): string[] {
  const out: string[] = [];
  for (const p of inputs) {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const f of fs.readdirSync(p)) if (f.toLowerCase().endsWith(".pdf")) out.push(path.join(p, f));
    } else out.push(p);
  }
  return out;
}

function getObj(page: any, id: string): Promise<any | null> {
  const store = id.startsWith("g_") ? page.commonObjs : page.objs;
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 3000);
    try {
      store.get(id, (o: any) => {
        clearTimeout(t);
        resolve(o ?? null);
      });
    } catch {
      clearTimeout(t);
      resolve(null);
    }
  });
}

async function toSharp(obj: any): Promise<boolean> {
  try {
    if (obj?.bitmap && typeof obj.bitmap.width === "number" && !obj.data) return false; // ImageBitmap: not usable in node
    const { width, height, data, kind } = obj;
    if (!data || !width || !height) return false;
    const channels = kind === 1 ? 1 : kind === 3 ? 4 : 3;
    let raw: Uint8Array = data;
    if (kind === 1) {
      // 1bpp packed -> 8bpp
      const rowBytes = Math.ceil(width / 8);
      raw = new Uint8Array(width * height);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) raw[y * width + x] = data[y * rowBytes + (x >> 3)] & (0x80 >> (x & 7)) ? 255 : 0;
    }
    const buf = await sharp(Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength), {
      raw: { width, height, channels: kind === 1 ? 1 : (channels as 3 | 4) },
    })
      .resize({ width: Math.min(width, 1600), withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return buf.length > 0;
  } catch {
    return false;
  }
}

async function spike(file: string) {
  const t0 = performance.now();
  const pdfjs: any = await loadPdfjs();
  const OPS = pdfjs.OPS;
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false, verbosity: 0, wasmUrl: WASM_URL }).promise;

  const placements: Placement[] = [];
  const headingPages = new Set<number>();
  let decodeOk = 0;
  let decodeTried = 0;
  const failKinds: Record<string, number> = {};
  const keyPages = new Map<string, Set<number>>();

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const pageArea = vp.width * vp.height;
    const ops = await page.getOperatorList();
    let ctm: Matrix = IDENTITY;
    const stack: Matrix[] = [];
    const found: { objId: string; w: number; h: number; areaRatio: number }[] = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() ?? IDENTITY;
      else if (fn === OPS.transform) ctm = mul(ctm, args as Matrix);
      else if (fn === OPS.paintFormXObjectBegin) {
        stack.push(ctm);
        if (args?.[0]) ctm = mul(ctm, args[0] as Matrix);
      } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? IDENTITY;
      else if (fn === OPS.paintImageXObject) {
        const objId = String(args[0]);
        const pw = Math.hypot(ctm[0], ctm[1]);
        const ph = Math.hypot(ctm[2], ctm[3]);
        found.push({ objId, w: pw, h: ph, areaRatio: (pw * ph) / pageArea });
      }
    }
    for (const f of found) {
      const set = keyPages.get(f.objId) ?? new Set<number>();
      set.add(p);
      keyPages.set(f.objId, set);
    }
    // text: heading-like = tallest short line, at least 1.4x the median height
    const tc = await page.getTextContent();
    const heights = tc.items.map((it: any) => it.height).filter((h: number) => h > 0).sort((a: number, b: number) => a - b);
    const median = heights[Math.floor(heights.length / 2)] ?? 0;
    if (tc.items.some((it: any) => it.str.trim().length >= 4 && it.str.length <= 60 && it.height >= median * 1.4)) headingPages.add(p);

    for (const f of found) {
      placements.push({
        page: p,
        objId: f.objId,
        w: f.w,
        h: f.h,
        areaRatio: f.areaRatio,
        minSide: Math.min(f.w, f.h),
        aspect: Math.max(f.w, f.h) / Math.max(1, Math.min(f.w, f.h)),
      });
      decodeTried++;
      const obj = await getObj(page, f.objId);
      if (!obj) failKinds["no-object"] = (failKinds["no-object"] ?? 0) + 1;
      else if (await toSharp(obj)) decodeOk++;
      else {
        const k = obj.bitmap ? "bitmap" : `kind-${obj.kind ?? "?"}`;
        failKinds[k] = (failKinds[k] ?? 0) + 1;
      }
    }
    page.cleanup();
  }

  const isBackground = (pl: Placement) =>
    pl.areaRatio > 0.85 || pl.minSide < 40 || pl.areaRatio < 0.03 || pl.aspect > 4 || (keyPages.get(pl.objId)?.size ?? 0) >= 3;
  const kept = placements.filter((p) => !isBackground(p));
  const keptPages = new Set(kept.map((p) => p.page));
  const matched = [...headingPages].filter((p) => keptPages.has(p)).length;
  const ms = performance.now() - t0;
  await doc.destroy?.();

  return {
    file: path.basename(file),
    pages: doc.numPages,
    seconds: +(ms / 1000).toFixed(1),
    placements: placements.length,
    decodeRate: placements.length ? +(decodeOk / decodeTried).toFixed(2) : null,
    kept: kept.length,
    headingPages: headingPages.size,
    headingWithPhoto: matched,
    matchProxy: headingPages.size ? +(matched / headingPages.size).toFixed(2) : null,
    failKinds,
  };
}

async function main() {
  const files = listPdfs(process.argv.slice(2));
  if (files.length === 0) throw new Error('usage: tsx scripts/spike-pdf-images.ts "<pdf or dir>"...');
  for (const f of files) {
    try {
      console.log(JSON.stringify(await spike(f)));
    } catch (e) {
      console.log(JSON.stringify({ file: path.basename(f), error: String(e) }));
    }
  }
}

main();
