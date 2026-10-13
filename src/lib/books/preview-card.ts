import type { BookCardData } from "@/components/ui/BookCard";
import { resolveCoverUrl } from "./cover-url";

export const PREVIEW_TITLE_PLACEHOLDER = "Título de tu recetario";

/** Card data for the live preview in the editor: the unsaved form values rendered by the real `BookCard`. */
export function toPreviewCard(input: {
  title: string;
  tagline: string;
  sellerName: string;
  priceCents: number;
  currency: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  coverUrl: string | null;
}): BookCardData {
  return {
    href: "#",
    title: input.title.trim() || PREVIEW_TITLE_PLACEHOLDER,
    tagline: input.tagline.trim() || null,
    sellerName: input.sellerName,
    priceCents: input.priceCents,
    currency: input.currency,
    primaryColor: input.primaryColor,
    backgroundColor: input.backgroundColor,
    textColor: input.textColor,
    coverUrl: resolveCoverUrl(input.coverUrl),
  };
}
