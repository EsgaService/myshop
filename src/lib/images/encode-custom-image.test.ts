import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectImageType } from "./detect-image-type";
import { encodeCustomImage } from "./encode-custom-image";

async function png(width: number, height: number): Promise<Uint8Array> {
  const buf = await sharp({ create: { width, height, channels: 3, background: "#cc3333" } }).png().toBuffer();
  return new Uint8Array(buf);
}

describe("encodeCustomImage", () => {
  it("re-encodes to WebP, capped at 1600px, with a 480px thumb", async () => {
    const out = await encodeCustomImage(await png(3200, 2000));
    expect(detectImageType(out.full)).toBe("webp");
    expect(detectImageType(out.thumb)).toBe("webp");
    expect(out.width).toBe(1600);
    expect(out.height).toBe(1000);
    expect((await sharp(out.thumb).metadata()).width).toBe(480);
  });

  it("never enlarges a small image", async () => {
    const out = await encodeCustomImage(await png(300, 200));
    expect(out.width).toBe(300);
    expect(out.height).toBe(200);
  });

  it("rejects bytes that are not a decodable image", async () => {
    await expect(encodeCustomImage(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow();
  });
});
