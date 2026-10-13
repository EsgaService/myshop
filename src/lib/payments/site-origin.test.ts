import { describe, expect, it } from "vitest";
import { originFromHeaders, resolveSiteOrigin } from "./site-origin";

describe("resolveSiteOrigin", () => {
  it("prefers the configured site URL (origin only)", () => {
    expect(resolveSiteOrigin({ siteUrl: "https://shop.test/", requestOrigin: "http://localhost:4000", nodeEnv: "development" })).toBe("https://shop.test");
    expect(resolveSiteOrigin({ siteUrl: "https://shop.test/algo", requestOrigin: undefined, nodeEnv: "production" })).toBe("https://shop.test");
  });

  it("falls back to the request origin outside production", () => {
    expect(resolveSiteOrigin({ siteUrl: "", requestOrigin: "http://localhost:4000", nodeEnv: "development" })).toBe("http://localhost:4000");
    expect(resolveSiteOrigin({ siteUrl: undefined, requestOrigin: "http://localhost:4000", nodeEnv: "test" })).toBe("http://localhost:4000");
  });

  it("never trusts the request origin in production (Host can be spoofed)", () => {
    expect(resolveSiteOrigin({ siteUrl: "", requestOrigin: "https://evil.test", nodeEnv: "production" })).toBeNull();
  });

  it("returns null when nothing absolute is available", () => {
    expect(resolveSiteOrigin({ siteUrl: "not a url", requestOrigin: undefined, nodeEnv: "development" })).toBeNull();
    expect(resolveSiteOrigin({ siteUrl: "javascript:alert(1)", requestOrigin: "ftp://x", nodeEnv: "development" })).toBeNull();
  });
});

describe("originFromHeaders", () => {
  it("builds the origin from host and forwarded proto", () => {
    expect(originFromHeaders(new Headers({ host: "localhost:4000" }))).toBe("http://localhost:4000");
    expect(originFromHeaders(new Headers({ host: "shop.test", "x-forwarded-proto": "https" }))).toBe("https://shop.test");
  });

  it("returns undefined without a usable host", () => {
    expect(originFromHeaders(new Headers())).toBeUndefined();
    expect(originFromHeaders(new Headers({ host: "bad host/../" }))).toBeUndefined();
  });
});
