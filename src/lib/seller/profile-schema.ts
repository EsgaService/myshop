import { z } from "zod";
import { isReservedSlug } from "@/lib/routing/reserved-slugs";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MAX = 40;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

const Schema = z.object({
  storeName: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(SLUG_MAX)
    .regex(SLUG_PATTERN)
    .refine((v) => !isReservedSlug(v), { message: "reserved" }),
  bio: optionalText(500),
  city: optionalText(80),
  instagram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, ""))
    .pipe(z.union([z.literal(""), z.string().regex(/^[A-Za-z0-9._]{1,30}$/)]))
    .transform((v) => (v === "" ? null : v)),
  whatsapp: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().regex(/^[+\d][\d\s()-]{5,24}$/).nullable()),
});

type Field = "storeName" | "slug" | "bio" | "city" | "instagram" | "whatsapp";

export type SellerProfileValue = {
  store_name: string;
  slug: string;
  bio: string | null;
  city: string | null;
  instagram: string | null;
  whatsapp: string | null;
};

export type SellerProfileResult =
  | { ok: true; value: SellerProfileValue }
  | { ok: false; errors: Partial<Record<Field, string>> };

export const SELLER_SLUG_TAKEN_MESSAGE = "Ese enlace ya no está disponible. Prueba con otro.";

const MESSAGES: Record<Field, string> = {
  storeName: "Escribe el nombre de tu tienda (máximo 80 caracteres).",
  slug: "Usa solo minúsculas, números y guiones (máximo 40 caracteres), por ejemplo dulces-de-ana.",
  bio: "La descripción puede tener máximo 500 caracteres.",
  city: "La ciudad puede tener máximo 80 caracteres.",
  instagram: "Escribe un usuario de Instagram válido, por ejemplo @dulces.ana.",
  whatsapp: "Escribe un número válido, por ejemplo +57 300 123 4567.",
};

const FIELDS = new Set<string>(["storeName", "slug", "bio", "city", "instagram", "whatsapp"]);

/**
 * Validates the seller profile form. Only these fields are read, so ownership
 * columns (id, user_id, is_platform) can never be written from the form.
 * Slug uniqueness is enforced by the database; callers map 23505 to SELLER_SLUG_TAKEN_MESSAGE.
 */
export function parseSellerProfile(input: Record<string, unknown>): SellerProfileResult {
  const str = (key: Field) => (typeof input[key] === "string" ? (input[key] as string) : "");
  const parsed = Schema.safeParse({
    storeName: str("storeName"),
    slug: str("slug"),
    bio: str("bio"),
    city: str("city"),
    instagram: str("instagram"),
    whatsapp: str("whatsapp"),
  });

  if (!parsed.success) {
    const errors: Partial<Record<Field, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && FIELDS.has(key)) {
        errors[key as Field] = key === "slug" && issue.message === "reserved" ? SELLER_SLUG_TAKEN_MESSAGE : MESSAGES[key as Field];
      }
    }
    return { ok: false, errors };
  }

  const d = parsed.data;
  return {
    ok: true,
    value: { store_name: d.storeName, slug: d.slug, bio: d.bio, city: d.city, instagram: d.instagram, whatsapp: d.whatsapp },
  };
}
