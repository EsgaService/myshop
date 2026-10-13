import sharp from "sharp";
import type { RawImage } from "./ports";

/**
 * Decodes a validated seller image (PNG/JPEG/WebP) to raw pixels, applying the EXIF orientation. The shared
 * `ImageEncoder` then re-encodes them, which drops metadata and any payload hidden in the original bytes.
 * Throws when the bytes are not a decodable image.
 */
export async function decodeCustomImage(input: Uint8Array): Promise<RawImage> {
  const source = sharp(input, { limitInputPixels: 100_000_000 }).rotate();
  const { hasAlpha } = await source.metadata();
  const pipeline = hasAlpha ? source.ensureAlpha() : source.removeAlpha();
  const { data, info } = await pipeline.toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    channels: info.channels as 3 | 4,
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
  };
}
