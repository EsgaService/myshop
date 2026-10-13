import { describe, expect, it } from "vitest";
import {
  CUSTOM_IMAGE_MAX_BYTES,
  CUSTOM_IMAGE_QUOTA,
  customImageErrorMessage,
  validateCustomImage,
} from "./validate-custom-image";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]);

describe("validateCustomImage (R3.5)", () => {
  it("accepts a small real image under the quota and reports its type", () => {
    expect(validateCustomImage({ head: JPEG, sizeBytes: 1_000_000, existingCustomCount: 3 })).toEqual({
      ok: true,
      type: "jpeg",
    });
  });

  it("accepts exactly 5 MB and rejects one byte more", () => {
    expect(CUSTOM_IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(validateCustomImage({ head: JPEG, sizeBytes: CUSTOM_IMAGE_MAX_BYTES, existingCustomCount: 0 }).ok).toBe(true);
    expect(validateCustomImage({ head: JPEG, sizeBytes: CUSTOM_IMAGE_MAX_BYTES + 1, existingCustomCount: 0 })).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("rejects an executable even when the file is named .jpg (magic bytes decide)", () => {
    expect(validateCustomImage({ head: EXE, sizeBytes: 100, existingCustomCount: 0 })).toEqual({
      ok: false,
      reason: "unsupported_type",
    });
  });

  it("rejects an empty file", () => {
    expect(validateCustomImage({ head: new Uint8Array(), sizeBytes: 0, existingCustomCount: 0 })).toEqual({
      ok: false,
      reason: "unsupported_type",
    });
  });

  it("enforces the quota of 300 custom images per seller", () => {
    expect(CUSTOM_IMAGE_QUOTA).toBe(300);
    expect(validateCustomImage({ head: JPEG, sizeBytes: 100, existingCustomCount: 299 }).ok).toBe(true);
    expect(validateCustomImage({ head: JPEG, sizeBytes: 100, existingCustomCount: 300 })).toEqual({
      ok: false,
      reason: "quota_reached",
    });
  });

  it("has a distinct user message per reason", () => {
    const messages = (["too_large", "unsupported_type", "quota_reached"] as const).map(customImageErrorMessage);
    expect(new Set(messages).size).toBe(3);
    expect(messages[2]).toContain("300");
  });
});
