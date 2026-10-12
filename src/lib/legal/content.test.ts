import { describe, expect, it } from "vitest";
import { LEGAL_REVIEW_NOTICE, PRIVACY, TERMS } from "./content";

describe("legal placeholder content", () => {
  it("flags both documents as pending legal review", () => {
    expect(LEGAL_REVIEW_NOTICE).toBe("Documento en revisión legal");
  });

  it("privacy policy references Colombian Ley 1581 de 2012", () => {
    const text = PRIVACY.sections.map((s) => `${s.heading} ${s.body.join(" ")}`).join(" ");
    expect(text).toContain("Ley 1581 de 2012");
  });

  it("each document has a title and non-empty sections", () => {
    for (const doc of [PRIVACY, TERMS]) {
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.sections.length).toBeGreaterThan(2);
      for (const s of doc.sections) {
        expect(s.heading.length).toBeGreaterThan(0);
        expect(s.body.length).toBeGreaterThan(0);
      }
    }
  });
});
