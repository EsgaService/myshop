import { describe, expect, it, vi } from "vitest";
import { ensureAccountCore, type AccountDeps } from "./ensure-account-core";
import type { AccountRole } from "./decide-role";

function makeDeps(overrides: Partial<AccountDeps> & { role?: AccountRole | null; legacy?: boolean; hasSeller?: boolean } = {}) {
  const { role = null, legacy = false, hasSeller = false, ...rest } = overrides;
  let stored: AccountRole | null = role;
  const deps = {
    getProfileRole: vi.fn(async () => stored),
    hasLegacyPurchases: vi.fn(async () => legacy),
    insertProfile: vi.fn(async (p: { role: AccountRole }) => {
      stored = stored ?? p.role; // on conflict do nothing
    }),
    hasSellerRow: vi.fn(async () => hasSeller),
    insertSeller: vi.fn(async () => {}),
    mirrorRole: vi.fn(async () => {}),
    ...rest,
  } satisfies AccountDeps;
  return deps;
}

const user = { userId: "u1", displayName: "Ana Pérez", avatarUrl: "http://a/x.png", email: "ana@example.com" };

describe("ensureAccountCore (R1)", () => {
  it("creates a seller profile, store and mirrors the role for a new user from the seller screen", async () => {
    const deps = makeDeps();
    const result = await ensureAccountCore(deps, { ...user, intent: "seller" });
    expect(result).toEqual({ role: "seller", isNew: true, mismatch: false });
    expect(deps.insertProfile).toHaveBeenCalledWith({ id: "u1", role: "seller", display_name: "Ana Pérez", avatar_url: "http://a/x.png" });
    expect(deps.insertSeller).toHaveBeenCalledWith({ userId: "u1", storeName: "Ana Pérez", avatarUrl: "http://a/x.png" });
    expect(deps.mirrorRole).toHaveBeenCalledWith("u1", "seller");
  });

  it("creates only a buyer profile for a new user from the buyer screen", async () => {
    const deps = makeDeps();
    const result = await ensureAccountCore(deps, { ...user, intent: "buyer" });
    expect(result.role).toBe("buyer");
    expect(deps.insertSeller).not.toHaveBeenCalled();
    expect(deps.mirrorRole).toHaveBeenCalledWith("u1", "buyer");
  });

  it("defaults forged intents to buyer", async () => {
    const deps = makeDeps();
    const result = await ensureAccountCore(deps, { ...user, intent: "admin" });
    expect(result.role).toBe("buyer");
    expect(deps.insertSeller).not.toHaveBeenCalled();
  });

  it("forces buyer for users with legacy purchases even from the seller screen", async () => {
    const deps = makeDeps({ legacy: true });
    const result = await ensureAccountCore(deps, { ...user, intent: "seller" });
    expect(result).toEqual({ role: "buyer", isNew: true, mismatch: true });
    expect(deps.insertSeller).not.toHaveBeenCalled();
  });

  it("never changes an existing buyer and reports the mismatch without writing", async () => {
    const deps = makeDeps({ role: "buyer" });
    const result = await ensureAccountCore(deps, { ...user, intent: "seller" });
    expect(result).toEqual({ role: "buyer", isNew: false, mismatch: true });
    expect(deps.insertProfile).not.toHaveBeenCalled();
    expect(deps.insertSeller).not.toHaveBeenCalled();
    expect(deps.mirrorRole).not.toHaveBeenCalled();
  });

  it("keeps an existing seller on the buyer screen and does not duplicate the store", async () => {
    const deps = makeDeps({ role: "seller", hasSeller: true });
    const result = await ensureAccountCore(deps, { ...user, intent: "buyer" });
    expect(result).toEqual({ role: "seller", isNew: false, mismatch: true });
    expect(deps.insertSeller).not.toHaveBeenCalled();
  });

  it("repairs an existing seller whose store row is missing", async () => {
    const deps = makeDeps({ role: "seller", hasSeller: false });
    await ensureAccountCore(deps, { ...user, intent: "seller" });
    expect(deps.insertSeller).toHaveBeenCalledTimes(1);
  });

  it("trusts the stored role when a concurrent request won the insert race", async () => {
    let stored: AccountRole | null = null;
    const deps = makeDeps({
      getProfileRole: vi.fn(async () => stored),
      insertProfile: vi.fn(async () => {
        stored = "buyer"; // another request inserted first
      }),
    });
    const result = await ensureAccountCore(deps, { ...user, intent: "seller" });
    expect(result).toEqual({ role: "buyer", isNew: false, mismatch: true });
    expect(deps.insertSeller).not.toHaveBeenCalled();
    expect(deps.mirrorRole).not.toHaveBeenCalled();
  });

  it("does not fail the login when mirroring the role to app_metadata fails", async () => {
    const deps = makeDeps({ mirrorRole: vi.fn(async () => { throw new Error("boom"); }) });
    await expect(ensureAccountCore(deps, { ...user, intent: "buyer" })).resolves.toMatchObject({ role: "buyer" });
  });

  it("derives a store name from the email when the display name is missing, and caps its length", async () => {
    const deps = makeDeps();
    await ensureAccountCore(deps, { ...user, displayName: null, intent: "seller" });
    expect(deps.insertSeller).toHaveBeenCalledWith(expect.objectContaining({ storeName: "ana" }));

    const long = makeDeps();
    await ensureAccountCore(long, { ...user, displayName: "x".repeat(200), intent: "seller" });
    const call = (long.insertSeller as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [{ storeName: string }];
    expect(call[0].storeName.length).toBe(80);
  });
});
