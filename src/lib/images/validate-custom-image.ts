import { detectImageType, type ImageType } from "./detect-image-type";

export const CUSTOM_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CUSTOM_IMAGE_QUOTA = 300;

export type CustomImageReason = "too_large" | "unsupported_type" | "quota_reached";
export type CustomImageDecision = { ok: true; type: ImageType } | { ok: false; reason: CustomImageReason };

/**
 * Server-side validation of a custom image before it is stored (R3.5). `head` holds the first bytes of the
 * uploaded file; the type comes from its magic bytes, never from the extension or MIME type.
 */
export function validateCustomImage(input: {
  head: Uint8Array;
  sizeBytes: number;
  existingCustomCount: number;
}): CustomImageDecision {
  if (input.sizeBytes > CUSTOM_IMAGE_MAX_BYTES) return { ok: false, reason: "too_large" };
  const type = detectImageType(input.head);
  if (!type) return { ok: false, reason: "unsupported_type" };
  if (input.existingCustomCount >= CUSTOM_IMAGE_QUOTA) return { ok: false, reason: "quota_reached" };
  return { ok: true, type };
}

export function customImageErrorMessage(reason: CustomImageReason): string {
  switch (reason) {
    case "too_large":
      return "La imagen pesa más de 5 MB. Elige una más liviana.";
    case "unsupported_type":
      return "Solo se aceptan imágenes JPG, PNG o WebP.";
    case "quota_reached":
      return `Llegaste al límite de ${CUSTOM_IMAGE_QUOTA} imágenes propias. Elimina alguna para subir otra.`;
  }
}
