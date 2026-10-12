import { z } from "zod";

const Schema = z.object({
  displayName: z.string().trim().min(1).max(80),
  phone: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().regex(/^[+\d][\d\s()-]{5,24}$/).nullable()),
  city: z.string().trim().max(80).transform((v) => (v === "" ? null : v)),
});

export type BuyerProfileValue = { display_name: string; phone: string | null; city: string | null };
export type BuyerProfileResult =
  | { ok: true; value: BuyerProfileValue }
  | { ok: false; errors: Partial<Record<"displayName" | "phone" | "city", string>> };

const MESSAGES = {
  displayName: "Escribe tu nombre (máximo 80 caracteres).",
  phone: "Escribe un teléfono válido, por ejemplo +57 300 123 4567.",
  city: "La ciudad puede tener máximo 80 caracteres.",
} as const;

/** Validates the buyer profile form. Only these fields are read: role can never be set from here. */
export function parseBuyerProfile(input: Record<string, unknown>): BuyerProfileResult {
  const phone = typeof input.phone === "string" ? input.phone : "";
  const rawCity = typeof input.city === "string" ? input.city : "";

  const parsed = Schema.safeParse({ displayName: input.displayName, phone, city: rawCity });
  const errors: Partial<Record<"displayName" | "phone" | "city", string>> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "displayName" || key === "phone" || key === "city") errors[key] = MESSAGES[key];
    }
  }
  if (!parsed.success) return { ok: false, errors };

  return {
    ok: true,
    value: { display_name: parsed.data.displayName, phone: parsed.data.phone, city: parsed.data.city },
  };
}
