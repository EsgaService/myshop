import type { CheckoutStore } from "./checkout-types";

/**
 * Defers loading the service-role store until a method is actually called, so resolving a provider
 * (e.g. to render a page or in unit tests) never pulls server-only modules.
 */
export function lazyCheckoutStore(): CheckoutStore {
  const load = async () => (await import("./checkout-store")).adminCheckoutStore;
  return {
    create: async (checkout) => (await load()).create(checkout),
    findByReference: async (reference) => (await load()).findByReference(reference),
    recordOutcome: async (reference, outcome) => (await load()).recordOutcome(reference, outcome),
    findReusablePending: async (query) => (await load()).findReusablePending(query),
    findByUserAndTransaction: async (userId, txId) => (await load()).findByUserAndTransaction(userId, txId),
    userHasCheckouts: async (userId) => (await load()).userHasCheckouts(userId),
  };
}
