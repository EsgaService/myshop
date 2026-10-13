import sharp from "sharp";
import type { ImageEncoder } from "./ports";

export const FULL_MAX_PX = 1600;
export const THUMB_PX = 480;
const WEBP_QUALITY = 80;
const THUMB_QUALITY = 70;

/** Re-encodes raw pixels to a WebP of at most 1600 px plus a 480 px thumb. */
export const sharpEncoder: ImageEncoder = {
  async toWebp(input) {
    const source = () => sharp(Buffer.from(input.data.buffer, input.data.byteOffset, input.data.byteLength), {
      raw: { width: input.width, height: input.height, channels: input.channels },
    });
    const full = await source()
      .resize({ width: FULL_MAX_PX, height: FULL_MAX_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    const thumb = await source()
      .resize({ width: THUMB_PX, height: THUMB_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();
    return { full: new Uint8Array(full.data), thumb: new Uint8Array(thumb), width: full.info.width, height: full.info.height };
  },
};
