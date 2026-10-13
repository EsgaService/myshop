export type PhotoSource = "auto" | "pdf" | "custom" | "none";

/** Label for the state of a recipe photo in the editor; "auto without path" (unmatched) differs from "none" (removed). */
export function describeRecipePhoto(input: { photoPath: string | null; photoSource: PhotoSource }): {
  hasPhoto: boolean;
  label: string;
} {
  if (!input.photoPath) {
    return {
      hasPhoto: false,
      label: input.photoSource === "none" ? "Sin foto (la quitaste)" : "Sin foto: no encontramos una imagen",
    };
  }
  switch (input.photoSource) {
    case "custom":
      return { hasPhoto: true, label: "Imagen propia" };
    case "pdf":
      return { hasPhoto: true, label: "Elegida de tu PDF" };
    default:
      return { hasPhoto: true, label: "Detectada en tu PDF" };
  }
}
