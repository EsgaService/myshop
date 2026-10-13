import type { ChoiceFailure } from "./decide-photo-choice";

export function choiceErrorMessage(reason: ChoiceFailure): string {
  switch (reason) {
    case "not_owner":
      return "No encontramos ese elemento en tu tienda.";
    case "image_not_found":
      return "No encontramos esa imagen.";
    case "image_not_allowed":
      return "Esa imagen no está disponible para este producto.";
  }
}
