import { describe, expect, it } from "vitest";
import { detectImageType } from "./detect-image-type";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe("detectImageType (R3.5)", () => {
  it("recognizes JPEG by its FF D8 FF signature", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe("jpeg");
  });

  it("recognizes PNG by its 8-byte signature", () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("png");
  });

  it("recognizes WebP by RIFF....WEBP", () => {
    expect(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP"), 0))).toBe("webp");
  });

  it("rejects RIFF containers that are not WebP", () => {
    expect(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE"), 0))).toBeNull();
  });

  it("rejects a Windows executable renamed to .jpg", () => {
    expect(detectImageType(bytes(0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0))).toBeNull();
  });

  it("rejects GIF, SVG text and buffers that are too short", () => {
    expect(detectImageType(bytes(...ascii("GIF89a"), 0, 0))).toBeNull();
    expect(detectImageType(bytes(...ascii("<svg xmlns=")))).toBeNull();
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
  });
});
