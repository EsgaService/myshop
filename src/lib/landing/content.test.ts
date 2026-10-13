import { describe, expect, it } from "vitest";
import { SELLER_PLAN } from "@/lib/seller/decide-subscription";
import { LANDING, landingHomeFor } from "./content";

const allCopy = JSON.stringify(LANDING).toLowerCase();

describe("landing CTAs", () => {
  it("points the seller CTA to seller auth and the login CTA to buyer auth", () => {
    expect(LANDING.ctas.sell).toEqual({ label: "Quiero vender", href: "/vendedor/ingresar" });
    expect(LANDING.ctas.login).toEqual({ label: "Iniciar sesión", href: "/ingresar" });
  });
});

describe("landingHomeFor", () => {
  it("shows login for anonymous visitors and the role panel for logged users", () => {
    expect(landingHomeFor(null)).toEqual({ label: "Iniciar sesión", href: "/ingresar" });
    expect(landingHomeFor("buyer")).toEqual({ label: "Ir a mi panel", href: "/mis-recetarios" });
    expect(landingHomeFor("seller")).toEqual({ label: "Ir a mi panel", href: "/vendedor" });
  });
});

describe("landing copy", () => {
  it("derives the plan price from SELLER_PLAN", () => {
    expect(SELLER_PLAN.amountCents).toBe(5_000_000);
    expect(LANDING.pricing.priceText).toMatch(/50\.000/);
    expect(LANDING.pricing.priceText).toMatch(/mes/);
  });

  it("describes three steps and at least four benefits", () => {
    expect(LANDING.steps).toHaveLength(3);
    expect(LANDING.benefits.length).toBeGreaterThanOrEqual(4);
    for (const item of [...LANDING.steps, ...LANDING.benefits]) {
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.text.length).toBeGreaterThan(0);
    }
  });

  it("mentions payment gateways generically and never names a specific gateway", () => {
    expect(allCopy).toContain("pasarelas de pago");
    expect(allCopy).not.toMatch(/dlocal|mercado\s*pago|stripe|wompi|payu|epayco/);
  });

  it("has a sample category marquee", () => {
    expect(LANDING.marquee.length).toBeGreaterThanOrEqual(4);
  });
});

describe("landing footer", () => {
  it("labels the legal links and does not expose the site owner", () => {
    expect(LANDING.footer.links).toEqual([
      { label: "Política de privacidad", href: "/privacidad" },
      { label: "Términos y condiciones", href: "/terminos" },
    ]);
    const footer = JSON.stringify(LANDING.footer);
    expect(footer).not.toContain("1090525663");
    expect(footer).not.toContain("Víctor Ortiz");
    expect("owner" in LANDING.footer).toBe(false);
  });
});
