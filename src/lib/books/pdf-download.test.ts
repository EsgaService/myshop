import { describe, expect, it } from "vitest";
import { downloadFileName, formatFileSize, pdfDownloadPath, toBookPdfs } from "./pdf-download";

describe("downloadFileName", () => {
  it("keeps a normal name", () => {
    expect(downloadFileName("Cocteles de verano.pdf")).toBe("Cocteles de verano.pdf");
  });

  it("adds the .pdf extension when missing", () => {
    expect(downloadFileName("recetas")).toBe("recetas.pdf");
  });

  it("strips path separators, quotes and control characters (header safety)", () => {
    const name = downloadFileName('..\\..\\evil/"na\r\nme".PDF');
    expect(name).not.toMatch(/[\\/"\r\n]/);
    expect(name.toLowerCase().endsWith(".pdf")).toBe(true);
  });

  it("falls back to a generic name when nothing usable remains", () => {
    expect(downloadFileName("///")).toBe("recetario.pdf");
    expect(downloadFileName("")).toBe("recetario.pdf");
  });

  it("bounds the length", () => {
    expect(downloadFileName("a".repeat(500) + ".pdf").length).toBeLessThanOrEqual(120);
  });
});

describe("formatFileSize", () => {
  it.each([
    [0, "0 KB"],
    [512, "1 KB"],
    [2048, "2 KB"],
    [1_572_864, "1,5 MB"],
    [20 * 1024 * 1024, "20 MB"],
  ])("formats %i bytes as %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});

describe("pdfDownloadPath", () => {
  it("builds the API path from ids", () => {
    expect(pdfDownloadPath("b1", "u1")).toBe("/api/books/b1/pdfs/u1");
  });
});

describe("toBookPdfs", () => {
  it("exposes only id, name and size: never the storage path", () => {
    const out = toBookPdfs([
      { id: "u1", original_name: "a.pdf", size_bytes: 100, storage_path: "seller/secret/a.pdf", created_at: "2026-01-01" },
    ] as never);
    expect(out).toEqual([{ id: "u1", name: "a.pdf", sizeBytes: 100 }]);
    expect(JSON.stringify(out)).not.toContain("secret");
  });
});
