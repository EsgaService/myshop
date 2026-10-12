import { z } from "zod";

/** Content blocks understood by the reader (`Block` in src/lib/data/types.ts). */
const BlockSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.enum(["p", "h"]), texto: z.string().min(1) }),
  z.object({ tipo: z.literal("ul"), items: z.array(z.string().min(1)) }),
  z.object({ tipo: z.literal("tabla"), filas: z.array(z.array(z.string())) }),
]);

const RecipeSchema = z.object({
  title: z.string().trim().min(1),
  category: z.string().trim().min(1).optional(),
  yield: z.string().optional(),
  time: z.string().optional(),
  ingredients: z.array(z.string().trim().min(1)).min(1),
  steps: z.array(z.string().trim().min(1)).min(1),
  notes: z.array(z.string()).default([]),
  extras: z.record(z.string(), z.string()).default({}),
});

/**
 * Contract between the AI provider and the platform. Single validation point
 * for both the mock and the Anthropic adapter; also the source of the
 * tool `input_schema` sent to the model.
 */
export const AiBookSchema = z.object({
  title: z.string().trim().min(1),
  tagline: z.string().optional(),
  description: z.string().optional(),
  sections: z.array(z.object({ title: z.string().trim().min(1), blocks: z.array(BlockSchema) })).default([]),
  categories: z.array(z.object({ name: z.string().trim().min(1), description: z.string().optional() })).default([]),
  recipes: z.array(RecipeSchema).min(1),
});

export type AiBook = z.infer<typeof AiBookSchema>;
export type AiBlock = z.infer<typeof BlockSchema>;

export type ParseAiBookResult = { ok: true; data: AiBook } | { ok: false; error: string };

export function parseAiBook(input: unknown): ParseAiBookResult {
  const result = AiBookSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const error = result.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
  return { ok: false, error };
}
