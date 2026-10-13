export type ImageRef = {
  id: string;
  sellerId: string;
  kind: "pdf" | "custom";
  uploadId: string | null;
  bookId: string | null;
  recipeId: string | null;
};

export type ChoiceFailure = "not_owner" | "image_not_found" | "image_not_allowed";

export type PhotoChoice =
  | { type: "candidate"; image: ImageRef | null }
  | { type: "custom"; image: ImageRef | null }
  | { type: "remove" };

export type PhotoDecision =
  | { ok: true; photoSource: "pdf" | "custom" | "none"; imageId: string | null }
  | { ok: false; reason: ChoiceFailure };

/** A candidate is valid only when it belongs to the seller and to an active upload of the same product. */
function candidateAllowed(image: ImageRef, sellerId: string, activeUploadIds: string[]): boolean {
  return (
    image.kind === "pdf" &&
    image.sellerId === sellerId &&
    image.uploadId !== null &&
    activeUploadIds.includes(image.uploadId)
  );
}

/**
 * Whether the seller may set this photo on this recipe (R3.3, R3.6). The caller loads the rows with the
 * service role; this decider holds every ownership rule.
 */
export function decidePhotoChoice(input: {
  sellerId: string;
  recipe: { id: string; bookSellerId: string };
  /** Active (not removed) uploads of the recipe's product. */
  activeUploadIds: string[];
  choice: PhotoChoice;
}): PhotoDecision {
  if (input.recipe.bookSellerId !== input.sellerId) return { ok: false, reason: "not_owner" };
  const { choice } = input;
  if (choice.type === "remove") return { ok: true, photoSource: "none", imageId: null };
  if (!choice.image) return { ok: false, reason: "image_not_found" };

  if (choice.type === "candidate") {
    return candidateAllowed(choice.image, input.sellerId, input.activeUploadIds)
      ? { ok: true, photoSource: "pdf", imageId: choice.image.id }
      : { ok: false, reason: "image_not_allowed" };
  }
  const own = choice.image.kind === "custom" && choice.image.sellerId === input.sellerId && choice.image.recipeId === input.recipe.id;
  return own ? { ok: true, photoSource: "custom", imageId: choice.image.id } : { ok: false, reason: "image_not_allowed" };
}

export type CoverChoice =
  | { type: "candidate"; image: ImageRef | null }
  | { type: "custom"; image: ImageRef | null }
  | { type: "clear" };

export type CoverDecision =
  | { ok: true; coverSource: "pdf" | "custom" | "none"; imageId: string | null }
  | { ok: false; reason: ChoiceFailure };

/** Whether the seller may set this cover on this product (R3.2, R3.6). */
export function decideCover(input: {
  sellerId: string;
  book: { id: string; sellerId: string };
  activeUploadIds: string[];
  choice: CoverChoice;
}): CoverDecision {
  if (input.book.sellerId !== input.sellerId) return { ok: false, reason: "not_owner" };
  const { choice } = input;
  if (choice.type === "clear") return { ok: true, coverSource: "none", imageId: null };
  if (!choice.image) return { ok: false, reason: "image_not_found" };

  if (choice.type === "candidate") {
    return candidateAllowed(choice.image, input.sellerId, input.activeUploadIds)
      ? { ok: true, coverSource: "pdf", imageId: choice.image.id }
      : { ok: false, reason: "image_not_allowed" };
  }
  const own = choice.image.kind === "custom" && choice.image.sellerId === input.sellerId && choice.image.bookId === input.book.id;
  return own ? { ok: true, coverSource: "custom", imageId: choice.image.id } : { ok: false, reason: "image_not_allowed" };
}
