import { describe, expect, it } from "vitest";
import { LEGACY_BOOK_SLUGS, legacyRedirects } from "./legacy-redirects";
import { RESERVED_SLUGS } from "./reserved-slugs";

describe("legacyRedirects", () => {
  it("maps each legacy store root and subpaths to the platform seller", () => {
    const rules = legacyRedirects();
    expect(rules).toContainEqual({ source: "/cocteles/:path*", destination: "/myshop/cocteles/:path*", permanent: true });
    expect(rules).toContainEqual({ source: "/micheladas/:path*", destination: "/myshop/micheladas/:path*", permanent: true });
  });

  it("emits one permanent (308) rule per legacy slug", () => {
    const rules = legacyRedirects();
    expect(rules).toHaveLength(LEGACY_BOOK_SLUGS.length);
    expect(rules.every((r) => r.permanent === true)).toBe(true);
  });

  it("only redirects slugs that are reserved so no seller can shadow them", () => {
    for (const slug of LEGACY_BOOK_SLUGS) expect(RESERVED_SLUGS).toContain(slug);
  });
});
