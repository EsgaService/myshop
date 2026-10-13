import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildCheckoutUrl, integritySignature } from "./signature";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("integritySignature", () => {
  it("hashes reference + amount + currency + secret", () => {
    expect(
      integritySignature({ reference: "sk8-438k4-xmxm392-sn2m", amountInCents: 2490000, currency: "COP", integritySecret: "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6" }),
    ).toBe(sha("sk8-438k4-xmxm392-sn2m2490000COPprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6"));
  });

  it("includes the expiration time before the secret when present", () => {
    const got = integritySignature({
      reference: "ref-1",
      amountInCents: 500000,
      currency: "COP",
      expirationTime: "2026-10-13T10:00:00.000Z",
      integritySecret: "test_integrity_x",
    });
    expect(got).toBe(sha("ref-1500000COP2026-10-13T10:00:00.000Ztest_integrity_x"));
  });

  it("changes when the amount changes", () => {
    const base = { reference: "r", currency: "COP", integritySecret: "s" };
    expect(integritySignature({ ...base, amountInCents: 1 })).not.toBe(integritySignature({ ...base, amountInCents: 2 }));
  });
});

describe("buildCheckoutUrl", () => {
  const input = {
    publicKey: "pub_test_k",
    integritySecret: "test_integrity_s",
    reference: "mys-p-abc",
    amountInCents: 500000,
    currency: "COP",
  };

  it("targets the hosted checkout with the required parameters", () => {
    const url = new URL(buildCheckoutUrl(input));
    expect(url.origin + url.pathname).toBe("https://checkout.wompi.co/p/");
    expect(url.searchParams.get("public-key")).toBe("pub_test_k");
    expect(url.searchParams.get("currency")).toBe("COP");
    expect(url.searchParams.get("amount-in-cents")).toBe("500000");
    expect(url.searchParams.get("reference")).toBe("mys-p-abc");
    expect(url.searchParams.get("signature:integrity")).toBe(
      integritySignature({ reference: "mys-p-abc", amountInCents: 500000, currency: "COP", integritySecret: "test_integrity_s" }),
    );
  });

  it("never puts the integrity secret in the URL", () => {
    const raw = buildCheckoutUrl({ ...input, redirectUrl: "https://shop.test/pagos/resultado" });
    expect(raw).not.toContain("test_integrity_s");
  });

  it("adds optional redirect, customer data and a signed expiration", () => {
    const url = new URL(
      buildCheckoutUrl({
        ...input,
        redirectUrl: "https://shop.test/pagos/resultado",
        expirationTime: "2026-10-13T10:00:00.000Z",
        customerEmail: "a@b.co",
        customerName: "Ana Perez",
      }),
    );
    expect(url.searchParams.get("redirect-url")).toBe("https://shop.test/pagos/resultado");
    expect(url.searchParams.get("expiration-time")).toBe("2026-10-13T10:00:00.000Z");
    expect(url.searchParams.get("customer-data:email")).toBe("a@b.co");
    expect(url.searchParams.get("customer-data:full-name")).toBe("Ana Perez");
    expect(url.searchParams.get("signature:integrity")).toBe(
      integritySignature({
        reference: "mys-p-abc",
        amountInCents: 500000,
        currency: "COP",
        expirationTime: "2026-10-13T10:00:00.000Z",
        integritySecret: "test_integrity_s",
      }),
    );
  });

  it("omits optional parameters that are empty", () => {
    const url = new URL(buildCheckoutUrl({ ...input, customerEmail: "", customerName: undefined }));
    expect(url.searchParams.has("customer-data:email")).toBe(false);
    expect(url.searchParams.has("customer-data:full-name")).toBe(false);
    expect(url.searchParams.has("redirect-url")).toBe(false);
    expect(url.searchParams.has("expiration-time")).toBe(false);
  });

  it.each(["a b", "a/b", "", "ñ"])("rejects an unsafe reference %j", (reference) => {
    expect(() => buildCheckoutUrl({ ...input, reference })).toThrow();
  });

  it.each([0, -5, 1.5, Number.NaN])("rejects an invalid amount %j", (amountInCents) => {
    expect(() => buildCheckoutUrl({ ...input, amountInCents })).toThrow();
  });
});
