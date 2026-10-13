/** Axis-aligned rectangle. Page space: origin top-left, units are PDF points, y grows downwards. */
export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { width: number; height: number };

/** One painted image on a page, before any pixel is decoded. */
export type Placement = {
  page: number; // 1-based
  /** Index of the paint operator in the page operator list (stable id within a page). */
  opIndex: number;
  /** pdf.js object id of the image: the same picture reused on several pages shares it. */
  key: string;
  bbox: Rect;
  pageSize: Size;
  /** Source image resolution in pixels. */
  pxWidth: number;
  pxHeight: number;
};

export type PageText = { page: number; lines: { text: string; y: number }[] };
