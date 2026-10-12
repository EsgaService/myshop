import { decideRole, type AccountRole, type RoleDecision } from "./decide-role";

/** I/O needed to create an account. Kept as an interface so the flow is unit-testable. */
export type AccountDeps = {
  getProfileRole(userId: string): Promise<AccountRole | null>;
  hasLegacyPurchases(userId: string): Promise<boolean>;
  /** Must be "insert ... on conflict do nothing": an existing role is never overwritten. */
  insertProfile(row: { id: string; role: AccountRole; display_name: string | null; avatar_url: string | null }): Promise<void>;
  hasSellerRow(userId: string): Promise<boolean>;
  insertSeller(row: { userId: string; storeName: string; avatarUrl: string | null }): Promise<void>;
  /** Mirrors the role to app_metadata (informational only; guards read `profiles`). */
  mirrorRole(userId: string, role: AccountRole): Promise<void>;
};

export type EnsureAccountInput = {
  userId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** Untrusted: the `as` param of the auth callback. Only used when no profile exists yet. */
  intent: string | null | undefined;
};

const STORE_NAME_MAX = 80;

function defaultStoreName(displayName: string | null, email: string | null): string {
  const fromName = displayName?.trim();
  if (fromName) return fromName.slice(0, STORE_NAME_MAX);
  const fromEmail = email?.split("@")[0]?.trim();
  return (fromEmail || "Mi tienda").slice(0, STORE_NAME_MAX);
}

/**
 * Creates the profile (and the seller store for sellers) on first login and
 * returns the effective role. An existing role is never changed (R1): a
 * mismatching screen only produces `mismatch: true`.
 */
export async function ensureAccountCore(deps: AccountDeps, input: EnsureAccountInput): Promise<RoleDecision> {
  const existingRole = await deps.getProfileRole(input.userId);
  const hasLegacyPurchases = existingRole ? false : await deps.hasLegacyPurchases(input.userId);
  let decision = decideRole({ existingRole, intent: input.intent, hasLegacyPurchases });

  if (decision.isNew) {
    await deps.insertProfile({
      id: input.userId,
      role: decision.role,
      display_name: input.displayName,
      avatar_url: input.avatarUrl,
    });
    // A concurrent request may have won the insert: the stored role is the truth.
    const stored = await deps.getProfileRole(input.userId);
    if (stored && stored !== decision.role) {
      decision = decideRole({ existingRole: stored, intent: input.intent, hasLegacyPurchases: false });
    } else {
      try {
        await deps.mirrorRole(input.userId, decision.role);
      } catch (e) {
        console.error("could not mirror role to app_metadata", e);
      }
    }
  }

  if (decision.role === "seller" && !(await deps.hasSellerRow(input.userId))) {
    await deps.insertSeller({
      userId: input.userId,
      storeName: defaultStoreName(input.displayName, input.email),
      avatarUrl: input.avatarUrl,
    });
  }

  return decision;
}
