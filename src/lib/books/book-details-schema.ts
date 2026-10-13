import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

const Schema = z.object({
  title: z.string().trim().min(1).max(120),
  tagline: optionalText(160),
  description: optionalText(2000),
});

type Field = "title" | "tagline" | "description";
export type BookDetailsResult =
  | { ok: true; value: { title: string; tagline: string | null; description: string | null } }
  | { ok: false; errors: Partial<Record<Field, string>> };

const MESSAGES: Record<Field, string> = {
  title: "Escribe un título (máximo 120 caracteres).",
  tagline: "El subtítulo puede tener máximo 160 caracteres.",
  description: "La descripción puede tener máximo 2000 caracteres.",
};

/** Editable listing text. Price, status and ownership are never read from here. */
export function parseBookDetails(input: Record<string, unknown>): BookDetailsResult {
  const str = (k: Field) => (typeof input[k] === "string" ? (input[k] as string) : "");
  const parsed = Schema.safeParse({ title: str("title"), tagline: str("tagline"), description: str("description") });
  if (!parsed.success) {
    const errors: Partial<Record<Field, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "title" || key === "tagline" || key === "description") errors[key] = MESSAGES[key];
    }
    return { ok: false, errors };
  }
  return { ok: true, value: parsed.data };
}
