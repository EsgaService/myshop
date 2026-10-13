import { describe, expect, it } from "vitest";
import { choiceErrorMessage } from "./choice-error-message";

describe("choiceErrorMessage", () => {
  it("gives a Spanish message for every failure and never leaks ownership details", () => {
    expect(choiceErrorMessage("not_owner")).toBe("No encontramos ese elemento en tu tienda.");
    expect(choiceErrorMessage("image_not_found")).toBe("No encontramos esa imagen.");
    expect(choiceErrorMessage("image_not_allowed")).toBe("Esa imagen no está disponible para este producto.");
  });
});
