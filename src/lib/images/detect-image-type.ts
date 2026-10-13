export type ImageType = "jpeg" | "png" | "webp";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);
}

/** Identifies jpeg / png / webp by magic bytes only. File name and MIME type are never trusted (R3.5). */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, PNG_SIGNATURE)) return "png";
  const riff = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
  const webp = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
  if (startsWith(bytes, riff) && startsWith(bytes, webp, 8)) return "webp";
  return null;
}
