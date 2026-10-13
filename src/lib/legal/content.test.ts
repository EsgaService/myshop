import { describe, expect, it } from "vitest";
import * as content from "./content";
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, PRIVACY, TERMS } from "./content";

const flatten = (doc: content.LegalDocument) =>
  doc.sections.map((s) => `${s.heading} ${s.body.join(" ")}`).join(" ");

describe("legal content", () => {
  it("no longer exports the legal review notice", () => {
    expect("LEGAL_REVIEW_NOTICE" in content).toBe(false);
  });

  it("exports last-updated date and contact email", () => {
    expect(LEGAL_LAST_UPDATED).toBe("12 de octubre de 2026");
    expect(LEGAL_CONTACT_EMAIL).toBe("victorup1902@gmail.com");
  });

  it("privacy policy cites the Colombian data protection framework", () => {
    const text = flatten(PRIVACY);
    expect(text).toContain("Ley 1581 de 2012");
    expect(text).toMatch(/Decreto 1377 de 2013|Decreto 1074 de 2015/);
    expect(text).toContain(LEGAL_CONTACT_EMAIL);
    expect(text).toContain("encargados");
    for (const processor of ["Google", "Supabase", "Anthropic"]) {
      expect(text).toContain(processor);
    }
    expect(PRIVACY.sections.length).toBeGreaterThanOrEqual(9);
  });

  it("terms cite consumer and e-commerce law and the withdrawal right", () => {
    const text = flatten(TERMS);
    expect(text).toContain("Ley 1480 de 2011");
    expect(text).toContain("Ley 527 de 1999");
    expect(text).toContain(LEGAL_CONTACT_EMAIL);
    expect(text).toContain("derecho de retracto");
    expect(TERMS.sections.length).toBeGreaterThanOrEqual(12);
  });

  it("each document has a title and non-empty sections", () => {
    for (const doc of [PRIVACY, TERMS]) {
      expect(doc.title.length).toBeGreaterThan(0);
      for (const s of doc.sections) {
        expect(s.heading.length).toBeGreaterThan(0);
        expect(s.body.length).toBeGreaterThan(0);
      }
    }
  });
});
