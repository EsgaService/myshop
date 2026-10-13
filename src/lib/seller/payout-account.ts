import { z } from "zod";

/**
 * Seller payout account ("Cuenta para pagos"). The platform collects every payment through its own
 * Wompi account and disburses earnings manually to this account. Sensitive personal data (Ley 1581).
 */
export const PAYOUT_BANKS = [
  "Bancolombia", "Davivienda", "Banco de Bogotá", "BBVA", "Banco de Occidente", "Banco Popular", "Scotiabank Colpatria",
  "Banco Caja Social", "Banco AV Villas", "Itaú", "Banco Agrario", "Banco Falabella", "Banco Pichincha", "Lulo Bank", "Nu",
] as const;

export const PAYOUT_WALLETS = ["Nequi", "Daviplata", "Movii", "Dale"] as const;

export const DOCUMENT_TYPES = ["CC", "CE", "NIT", "PP"] as const;

export type PayoutMethod = "bank" | "wallet";

export type PayoutAccountValue = {
  method: PayoutMethod;
  institution: string;
  account_type: "savings" | "checking" | null;
  account_number: string;
  holder_name: string;
  holder_document_type: (typeof DOCUMENT_TYPES)[number];
  holder_document_number: string;
};

type Field = "method" | "institution" | "accountType" | "accountNumber" | "holderName" | "documentType" | "documentNumber";

export type PayoutAccountResult = { ok: true; value: PayoutAccountValue } | { ok: false; errors: Partial<Record<Field, string>> };

const MESSAGES: Record<Field, string> = {
  method: "Elige si recibirás en una cuenta bancaria o en una billetera.",
  institution: "Elige una opción de la lista.",
  accountType: "Elige si es cuenta de ahorros o corriente.",
  accountNumber: "Revisa el número: solo dígitos.",
  holderName: "Escribe el nombre completo del titular (entre 3 y 120 caracteres).",
  documentType: "Elige el tipo de documento.",
  documentNumber: "Revisa el número de documento.",
};
const WALLET_NUMBER_MESSAGE = "Escribe el celular de tu billetera: 10 dígitos que empiecen por 3.";
const BANK_NUMBER_MESSAGE = "El número de cuenta debe tener entre 6 y 20 dígitos.";

const text = z.string().default("");

const Schema = z
  .object({
    method: text,
    institution: text,
    accountType: text,
    accountNumber: text,
    holderName: text,
    documentType: text,
    documentNumber: text,
  })
  .superRefine((d, ctx) => {
    const add = (path: Field, message?: string) => ctx.addIssue({ code: "custom", path: [path], message: message ?? MESSAGES[path] });

    if (d.method !== "bank" && d.method !== "wallet") add("method");
    const list: readonly string[] = d.method === "wallet" ? PAYOUT_WALLETS : PAYOUT_BANKS;
    if (d.method === "bank" || d.method === "wallet") {
      if (!list.includes(d.institution)) add("institution");
    }
    if (d.method === "bank" && d.accountType !== "savings" && d.accountType !== "checking") add("accountType");

    const digits = d.accountNumber.replace(/[\s-]/g, "");
    if (d.method === "wallet") {
      const mobile = /^57\d{10}$/.test(digits.replace(/^\+/, "")) ? digits.replace(/^\+/, "").slice(2) : digits;
      if (!/^3\d{9}$/.test(mobile)) add("accountNumber", WALLET_NUMBER_MESSAGE);
    } else if (!/^\d{6,20}$/.test(digits)) {
      add("accountNumber", d.method === "bank" ? BANK_NUMBER_MESSAGE : undefined);
    }

    const name = d.holderName.trim().replace(/\s+/g, " ");
    if (name.length < 3 || name.length > 120) add("holderName");

    if (!(DOCUMENT_TYPES as readonly string[]).includes(d.documentType)) add("documentType");
    else {
      const raw = d.documentNumber.trim();
      const ok = d.documentType === "PP" ? /^[A-Za-z0-9]{5,15}$/.test(raw) : /^\d{5,15}$/.test(raw.replace(/[.\s-]/g, ""));
      if (!ok) add("documentNumber");
    }
  });

const FIELDS = new Set<string>(Object.keys(MESSAGES));

/**
 * Validates and normalizes the payout form. Only these fields are read, so `seller_id` can never be
 * written from the form (the caller supplies it from the session).
 */
export function parsePayoutAccount(input: Record<string, unknown>): PayoutAccountResult {
  const str = (key: Field) => (typeof input[key] === "string" ? (input[key] as string) : "");
  const parsed = Schema.safeParse({
    method: str("method"),
    institution: str("institution"),
    accountType: str("accountType"),
    accountNumber: str("accountNumber"),
    holderName: str("holderName"),
    documentType: str("documentType"),
    documentNumber: str("documentNumber"),
  });

  if (!parsed.success) {
    const errors: Partial<Record<Field, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && FIELDS.has(key) && !errors[key as Field]) errors[key as Field] = issue.message;
    }
    return { ok: false, errors };
  }

  const d = parsed.data;
  const method = d.method as PayoutMethod;
  let accountNumber = d.accountNumber.replace(/[\s-]/g, "").replace(/^\+/, "");
  if (method === "wallet" && /^57\d{10}$/.test(accountNumber)) accountNumber = accountNumber.slice(2);
  const documentNumber =
    d.documentType === "PP" ? d.documentNumber.trim().toUpperCase() : d.documentNumber.replace(/[.\s-]/g, "");

  return {
    ok: true,
    value: {
      method,
      institution: d.institution,
      account_type: method === "bank" ? (d.accountType as "savings" | "checking") : null,
      account_number: accountNumber,
      holder_name: d.holderName.trim().replace(/\s+/g, " "),
      holder_document_type: d.documentType as PayoutAccountValue["holder_document_type"],
      holder_document_number: documentNumber,
    },
  };
}

/** Shows only the last 4 digits; short numbers are fully hidden. */
export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return "•".repeat(accountNumber.length);
  return "•".repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}
