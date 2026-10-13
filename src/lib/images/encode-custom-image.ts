import sharp from "sharp";

const FULL_MAX = 1600;
const THUMB_WIDTH = 480;
const QUALITY = 82;

export type EncodedImage = { full: Uint8Array; thumb: Uint8Array; width: number; height: number };

/**
 * Re-encodes a validated seller image to WebP (max 1600px) plus a 480px thumb. Re-encoding drops metadata and
 * any payload hidden in the original bytes. Throws when the bytes are not a decodable image.
 *
 * Minimal sharp adapter for custom uploads; once the shared `ImageEncoder` port exists it can replace this.
 */
export async function encodeCustomImage(input: Uint8Array): Promise<EncodedImage> {
  const source = sharp(input, { limitInputPixels: 100_000_000 }).rotate();
  const full = await source
    .clone()
    .resize({ width: FULL_MAX, height: FULL_MAX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer({ resolveWithObject: true });
  const thumb = await source
    .clone()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
  return { full: new Uint8Array(full.data), thumb: new Uint8Array(thumb), width: full.info.width, height: full.info.height };
}
