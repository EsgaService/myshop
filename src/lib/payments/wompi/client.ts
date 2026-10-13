import { z } from "zod";
import type { WompiConfig } from "./config";
import type { WompiTransaction } from "./events";

const TRANSACTION_ID = /^[A-Za-z0-9_-]{1,100}$/;

const ApiSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    reference: z.string().min(1),
    amount_in_cents: z.number().int(),
    currency: z.string().min(1),
    status: z.string().min(1),
  }),
});

export type FetchTransactionResult =
  | { ok: true; transaction: WompiTransaction }
  | { ok: false; reason: "not_found" | "unavailable" };

/**
 * Server-to-server read of a transaction (`GET /transactions/{id}`, private key). This is the trusted
 * source for the return page: the `?id=` of the redirect URL is user-controlled and proves nothing.
 */
export async function fetchWompiTransaction(input: {
  config: WompiConfig;
  id: string;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
}): Promise<FetchTransactionResult> {
  // The id comes from a query string: never let it shape the request path.
  if (!TRANSACTION_ID.test(input.id)) return { ok: false, reason: "not_found" };
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${input.config.apiBase}/transactions/${input.id}`, {
      headers: { Authorization: `Bearer ${input.config.privateKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const parsed = ApiSchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, reason: "unavailable" };
    const t = parsed.data.data;
    return {
      ok: true,
      transaction: { id: t.id, reference: t.reference, amountInCents: t.amount_in_cents, currency: t.currency, status: t.status },
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
