import { describe, expect, it } from "vitest";
import { PAYOUT_BANKS, PAYOUT_WALLETS, maskAccountNumber, parsePayoutAccount } from "./payout-account";

const bank = {
  method: "bank",
  institution: "Bancolombia",
  accountType: "savings",
  accountNumber: "123-456 789 01",
  holderName: "  Ana   María Pérez ",
  documentType: "CC",
  documentNumber: "1.020.304.050",
};
const wallet = {
  method: "wallet",
  institution: "Nequi",
  accountType: "",
  accountNumber: "300 123 4567",
  holderName: "Ana Pérez",
  documentType: "CC",
  documentNumber: "1020304050",
};

describe("parsePayoutAccount", () => {
  it("normalizes a valid bank account", () => {
    expect(parsePayoutAccount(bank)).toEqual({
      ok: true,
      value: {
        method: "bank",
        institution: "Bancolombia",
        account_type: "savings",
        account_number: "12345678901",
        holder_name: "Ana María Pérez",
        holder_document_type: "CC",
        holder_document_number: "1020304050",
      },
    });
  });

  it("accepts a wallet with a Colombian mobile number and no account type", () => {
    expect(parsePayoutAccount(wallet)).toMatchObject({
      ok: true,
      value: { method: "wallet", institution: "Nequi", account_type: null, account_number: "3001234567" },
    });
  });

  it("accepts a +57 prefix on wallet numbers", () => {
    expect(parsePayoutAccount({ ...wallet, accountNumber: "+57 300 123 4567" })).toMatchObject({ ok: true, value: { account_number: "3001234567" } });
  });

  it.each(["1234567890", "300123456", "30012345678", "abc"])("rejects wallet number %s", (accountNumber) => {
    expect(parsePayoutAccount({ ...wallet, accountNumber })).toMatchObject({ ok: false, errors: { accountNumber: expect.any(String) } });
  });

  it("requires an account type for banks", () => {
    expect(parsePayoutAccount({ ...bank, accountType: "" })).toMatchObject({ ok: false, errors: { accountType: expect.any(String) } });
    expect(parsePayoutAccount({ ...bank, accountType: "other" })).toMatchObject({ ok: false });
  });

  it("drops the account type for wallets even if sent", () => {
    expect(parsePayoutAccount({ ...wallet, accountType: "savings" })).toMatchObject({ ok: true, value: { account_type: null } });
  });

  it("rejects institutions that do not match the method", () => {
    expect(parsePayoutAccount({ ...bank, institution: "Nequi" })).toMatchObject({ ok: false, errors: { institution: expect.any(String) } });
    expect(parsePayoutAccount({ ...wallet, institution: "Bancolombia" })).toMatchObject({ ok: false, errors: { institution: expect.any(String) } });
    expect(parsePayoutAccount({ ...bank, institution: "Banco Inventado" })).toMatchObject({ ok: false });
  });

  it("rejects unknown methods", () => {
    expect(parsePayoutAccount({ ...bank, method: "cash" })).toMatchObject({ ok: false, errors: { method: expect.any(String) } });
  });

  it.each(["123", "12345678901234567890123", "12ab5678"])("rejects bank account number %s", (accountNumber) => {
    expect(parsePayoutAccount({ ...bank, accountNumber })).toMatchObject({ ok: false, errors: { accountNumber: expect.any(String) } });
  });

  it("validates the holder name", () => {
    expect(parsePayoutAccount({ ...bank, holderName: "A" })).toMatchObject({ ok: false, errors: { holderName: expect.any(String) } });
    expect(parsePayoutAccount({ ...bank, holderName: "x".repeat(121) })).toMatchObject({ ok: false });
  });

  it("validates document type and number", () => {
    expect(parsePayoutAccount({ ...bank, documentType: "TI" })).toMatchObject({ ok: false, errors: { documentType: expect.any(String) } });
    expect(parsePayoutAccount({ ...bank, documentNumber: "12" })).toMatchObject({ ok: false, errors: { documentNumber: expect.any(String) } });
    expect(parsePayoutAccount({ ...bank, documentType: "NIT", documentNumber: "900.123.456-7" })).toMatchObject({
      ok: true,
      value: { holder_document_number: "9001234567" },
    });
    expect(parsePayoutAccount({ ...bank, documentType: "PP", documentNumber: "ab123456" })).toMatchObject({
      ok: true,
      value: { holder_document_number: "AB123456" },
    });
    expect(parsePayoutAccount({ ...bank, documentType: "CC", documentNumber: "ab123456" })).toMatchObject({ ok: false });
  });

  it("ignores unexpected keys: ownership columns can never be written from the form", () => {
    const r = parsePayoutAccount({ ...bank, seller_id: "someone-else", updated_at: "x" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.value)).not.toContain("seller_id");
  });

  it("ignores non-string input values", () => {
    expect(parsePayoutAccount({ ...bank, accountNumber: 123456789 })).toMatchObject({ ok: false });
  });

  it("returns an error per invalid field", () => {
    const r = parsePayoutAccount({});
    expect(r.ok).toBe(false);
  });
});

describe("institutions", () => {
  it("lists the supported banks and wallets", () => {
    expect(PAYOUT_BANKS).toEqual([
      "Bancolombia", "Davivienda", "Banco de Bogotá", "BBVA", "Banco de Occidente", "Banco Popular", "Scotiabank Colpatria",
      "Banco Caja Social", "Banco AV Villas", "Itaú", "Banco Agrario", "Banco Falabella", "Banco Pichincha", "Lulo Bank", "Nu",
    ]);
    expect(PAYOUT_WALLETS).toEqual(["Nequi", "Daviplata", "Movii", "Dale"]);
  });
});

describe("maskAccountNumber", () => {
  it("shows only the last 4 digits", () => {
    expect(maskAccountNumber("12345678901")).toBe("•••••••8901");
    expect(maskAccountNumber("3001234567")).toBe("••••••4567");
  });

  it("never reveals short numbers", () => {
    expect(maskAccountNumber("123")).toBe("•••");
    expect(maskAccountNumber("")).toBe("");
  });
});
