import { describe, expect, it } from "vitest";
import { parseWompiConfig } from "./config";

const test = {
  WOMPI_PUBLIC_KEY: "pub_test_abc123",
  WOMPI_PRIVATE_KEY: "prv_test_abc123",
  WOMPI_EVENTS_SECRET: "test_events_abc123",
  WOMPI_INTEGRITY_SECRET: "test_integrity_abc123",
};
const prod = {
  WOMPI_PUBLIC_KEY: "pub_prod_abc123",
  WOMPI_PRIVATE_KEY: "prv_prod_abc123",
  WOMPI_EVENTS_SECRET: "prod_events_abc123",
  WOMPI_INTEGRITY_SECRET: "prod_integrity_abc123",
};

describe("parseWompiConfig", () => {
  it("derives the sandbox environment and API base from the public key prefix", () => {
    const r = parseWompiConfig(test);
    expect(r).toMatchObject({ ok: true, config: { environment: "test", apiBase: "https://sandbox.wompi.co/v1" } });
  });

  it("derives the production environment and API base", () => {
    const r = parseWompiConfig(prod);
    expect(r).toMatchObject({ ok: true, config: { environment: "prod", apiBase: "https://production.wompi.co/v1" } });
  });

  it("exposes the four credentials", () => {
    const r = parseWompiConfig(test);
    expect(r.ok && r.config).toMatchObject({
      publicKey: "pub_test_abc123",
      privateKey: "prv_test_abc123",
      eventsSecret: "test_events_abc123",
      integritySecret: "test_integrity_abc123",
    });
  });

  it("trims whitespace around values", () => {
    expect(parseWompiConfig({ ...test, WOMPI_PUBLIC_KEY: "  pub_test_abc123\n" }).ok).toBe(true);
  });

  it.each(Object.keys(test))("fails when %s is missing or blank", (key) => {
    expect(parseWompiConfig({ ...test, [key]: undefined }).ok).toBe(false);
    expect(parseWompiConfig({ ...test, [key]: "  " }).ok).toBe(false);
  });

  it.each([
    ["WOMPI_INTEGRITY_SECRET", prod.WOMPI_INTEGRITY_SECRET],
    ["WOMPI_EVENTS_SECRET", prod.WOMPI_EVENTS_SECRET],
    ["WOMPI_PRIVATE_KEY", prod.WOMPI_PRIVATE_KEY],
  ])("refuses a test public key mixed with a production %s", (key, value) => {
    expect(parseWompiConfig({ ...test, [key]: value }).ok).toBe(false);
  });

  it("refuses a production public key mixed with a test integrity secret", () => {
    expect(parseWompiConfig({ ...prod, WOMPI_INTEGRITY_SECRET: test.WOMPI_INTEGRITY_SECRET }).ok).toBe(false);
  });

  it("refuses keys of the wrong kind in a slot (private key in the public slot)", () => {
    expect(parseWompiConfig({ ...test, WOMPI_PUBLIC_KEY: "prv_test_abc123" }).ok).toBe(false);
    expect(parseWompiConfig({ ...test, WOMPI_PRIVATE_KEY: "pub_test_abc123" }).ok).toBe(false);
  });

  it("never echoes secret values in the error", () => {
    const r = parseWompiConfig({ ...test, WOMPI_INTEGRITY_SECRET: prod.WOMPI_INTEGRITY_SECRET });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toMatch(/abc123/);
  });
});
