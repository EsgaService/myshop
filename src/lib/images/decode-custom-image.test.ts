import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectImageType } from "./detect-image-type";
import { decodeCustomImage } from "./decode-custom-image";
import { sharpEncoder } from "./sharp-encoder";

async function png(width: number, height: number, channels: 3 | 4 = 3): Promise<Uint8Array> {
  const background = channels === 4 ? { r: 200, g: 50, b: 50, alpha: 0.5 } : "#cc3333";
  const buf = await sharp({ create: { width, height, channels, background } }).png().toBuffer();
  return new Uint8Array(buf);
}

describe("decodeCustomImage + sharpEncoder", () => {
  it("decodes to RGB raw pixels and re-encodes to WebP capped at 1600px with a 480px thumb", async () => {
    const raw = await decodeCustomImage(await png(3200, 2000));
    expect(raw.channels).toBe(3);
    expect(raw.width).toBe(3200);
    const out = await sharpEncoder.toWebp(raw);
    expect(detectImageType(out.full)).toBe("webp");
    expect(detectImageType(out.thumb)).toBe("webp");
    expect(out.width).toBe(1600);
    expect(out.height).toBe(1000);
    expect((await sharp(out.thumb).metadata()).width).toBe(480);
  });

  it("keeps the alpha channel when the source has one", async () => {
    const raw = await decodeCustomImage(await png(100, 80, 4));
    expect(raw.channels).toBe(4);
  });

  it("applies the EXIF orientation", async () => {
    const buf = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#336699" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const raw = await decodeCustomImage(new Uint8Array(buf));
    expect(raw.width).toBe(100);
    expect(raw.height).toBe(200);
  });

  it("rejects bytes that are not a decodable image", async () => {
    await expect(decodeCustomImage(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow();
  });
});
