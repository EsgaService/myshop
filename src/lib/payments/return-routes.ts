import type { PaymentKind } from "./types";

/** Path Wompi sends the payer back to (it appends `?id=<transactionId>`). Subscriptions get their own path so a signed-out seller lands on the seller sign-in. */
export function paymentResultPath(kind: PaymentKind): string {
  return kind === "subscription" ? "/pagos/resultado/suscripcion" : "/pagos/resultado";
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;

/** Sign-in URL that returns to the payment result page. The `next` is validated again by the auth callback (decidePostLogin). */
export function signInUrlForPaymentResult(input: { kind: PaymentKind; id: string | undefined }): string {
  const base = paymentResultPath(input.kind);
  const next = input.id && SAFE_ID.test(input.id) ? `${base}?id=${input.id}` : base;
  const signIn = input.kind === "subscription" ? "/vendedor/ingresar" : "/ingresar";
  return `${signIn}?next=${encodeURIComponent(next)}`;
}
