export type AccountRole = "buyer" | "seller";

export type RoleDecision = {
  role: AccountRole;
  /** True when no profile existed yet, so the role is being assigned now. */
  isNew: boolean;
  /** True when the screen the user came from does not match the role they end up with. */
  mismatch: boolean;
};

function parseIntent(intent: string | null | undefined): AccountRole | null {
  return intent === "buyer" || intent === "seller" ? intent : null;
}

/**
 * The role is assigned exactly once, at first profile creation, from the auth
 * screen the user used. An existing role is never changed. `intent` is
 * untrusted input: anything other than the two allowlisted values is ignored.
 */
export function decideRole(input: {
  existingRole: AccountRole | null;
  intent: string | null | undefined;
  hasLegacyPurchases: boolean;
}): RoleDecision {
  const intent = parseIntent(input.intent);

  if (input.existingRole) {
    return { role: input.existingRole, isNew: false, mismatch: intent !== null && intent !== input.existingRole };
  }

  // Pre-marketplace purchasers are buyers no matter which screen they used.
  const role: AccountRole = input.hasLegacyPurchases ? "buyer" : (intent ?? "buyer");
  return { role, isNew: true, mismatch: intent !== null && intent !== role };
}
