import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCoverUrl } from "./cover-url";

afterEach(() => vi.unstubAllEnvs());

describe("resolveCoverUrl", () => {
  it("returns null when there is no cover", () => {
    expect(resolveCoverUrl(null)).toBeNull();
    expect(resolveCoverUrl(undefined)).toBeNull();
    expect(resolveCoverUrl("   ")).toBeNull();
  });

  it("keeps absolute http(s) URLs", () => {
    expect(resolveCoverUrl("https://cdn.example.com/a.webp")).toBe("https://cdn.example.com/a.webp");
  });

  it("resolves storage paths against the public recipe-photos bucket", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    expect(resolveCoverUrl("seller/up/1.webp")).toBe("https://x.supabase.co/storage/v1/object/public/recipe-photos/seller/up/1.webp");
  });

  it("returns null for unsafe schemes", () => {
    expect(resolveCoverUrl("javascript:alert(1)")).toBeNull();
    expect(resolveCoverUrl("data:text/html,x")).toBeNull();
  });
});
