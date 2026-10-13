import { describe, expect, it } from "vitest";
import { paymentResultPath, signInUrlForPaymentResult } from "./return-routes";

describe("paymentResultPath", () => {
  it("uses a separate path for subscriptions so a signed-out seller can be sent to the seller sign-in", () => {
    expect(paymentResultPath("purchase")).toBe("/pagos/resultado");
    expect(paymentResultPath("subscription")).toBe("/pagos/resultado/suscripcion");
  });
});

describe("signInUrlForPaymentResult", () => {
  it("sends buyers to /ingresar and keeps the return URL with the transaction id", () => {
    expect(signInUrlForPaymentResult({ kind: "purchase", id: "123-abc" })).toBe(`/ingresar?next=${encodeURIComponent("/pagos/resultado?id=123-abc")}`);
  });

  it("sends sellers paying a subscription to /vendedor/ingresar", () => {
    expect(signInUrlForPaymentResult({ kind: "subscription", id: "123-abc" })).toBe(
      `/vendedor/ingresar?next=${encodeURIComponent("/pagos/resultado/suscripcion?id=123-abc")}`,
    );
  });

  it("drops an unsafe id instead of echoing it into the redirect", () => {
    expect(signInUrlForPaymentResult({ kind: "purchase", id: "x&next=//evil.com" })).toBe(`/ingresar?next=${encodeURIComponent("/pagos/resultado")}`);
    expect(signInUrlForPaymentResult({ kind: "purchase", id: undefined })).toBe(`/ingresar?next=${encodeURIComponent("/pagos/resultado")}`);
  });
});
