import { describe, expect, it, vi } from "vitest";
import { runUploadBatch, type UploadBatchDeps } from "./upload-batch";

type TestFile = { name: string; size: number; type: string };

const pdf = (name: string, size = 1_000): TestFile => ({ name, size, type: "application/pdf" });

function makeDeps(over: Partial<UploadBatchDeps<TestFile>> = {}) {
  const calls: string[] = [];
  const deps: UploadBatchDeps<TestFile> = {
    checkBatchCapacity: vi.fn(async () => ({ ok: true }) as const),
    resolveBookId: vi.fn(async () => ({ ok: true, bookId: "book-1" }) as const),
    requestUpload: vi.fn(async (input) => {
      calls.push(`request:${input.name}`);
      return {
        ok: true,
        uploadId: `up-${input.name}`,
        path: `s/${input.name}`,
        signedUrl: "https://x",
        token: "t",
        activeCount: 1,
      } as const;
    }),
    putFile: vi.fn(async (prepared) => {
      calls.push(`put:${prepared.uploadId}`);
      return { ok: true } as const;
    }),
    confirmUpload: vi.fn(async (uploadId) => {
      calls.push(`confirm:${uploadId}`);
      return { ok: true } as const;
    }),
    ...over,
  };
  return { deps, calls };
}

describe("runUploadBatch (R1.2, R1.4, R1.7)", () => {
  it("runs request -> put -> confirm per file, sequentially and in selection order", async () => {
    const { deps, calls } = makeDeps();
    const result = await runUploadBatch([pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")], deps);
    expect(calls).toEqual([
      "request:a.pdf", "put:up-a.pdf", "confirm:up-a.pdf",
      "request:b.pdf", "put:up-b.pdf", "confirm:up-b.pdf",
      "request:c.pdf", "put:up-c.pdf", "confirm:up-c.pdf",
    ]);
    expect(result.batchError).toBeUndefined();
    expect(result.outcomes.map((o) => [o.name, o.ok])).toEqual([["a.pdf", true], ["b.pdf", true], ["c.pdf", true]]);
    expect(deps.requestUpload).toHaveBeenCalledWith({ name: "a.pdf", size: 1_000, mime: "application/pdf", bookId: "book-1" });
  });

  it("rejects the whole batch before creating a product or uploading anything when it exceeds the cap", async () => {
    const { deps } = makeDeps({
      checkBatchCapacity: vi.fn(async () => ({ ok: false, message: "Solo puedes subir 1 PDF más" }) as const),
    });
    const result = await runUploadBatch([pdf("a.pdf"), pdf("b.pdf")], deps);
    expect(result.batchError).toBe("Solo puedes subir 1 PDF más");
    expect(result.outcomes).toEqual([]);
    expect(deps.checkBatchCapacity).toHaveBeenCalledWith(2);
    expect(deps.resolveBookId).not.toHaveBeenCalled();
    expect(deps.requestUpload).not.toHaveBeenCalled();
  });

  it("rejects an invalid file on its own and counts only valid files against the cap", async () => {
    const { deps } = makeDeps();
    const big = pdf("big.pdf", 21 * 1024 * 1024);
    const notPdf = { name: "foto.png", size: 10, type: "image/png" };
    const result = await runUploadBatch([pdf("a.pdf"), big, notPdf, pdf("b.pdf")], deps);
    expect(deps.checkBatchCapacity).toHaveBeenCalledWith(2);
    expect(result.outcomes.map((o) => [o.name, o.ok])).toEqual([
      ["a.pdf", true], ["big.pdf", false], ["foto.png", false], ["b.pdf", true],
    ]);
    const failed = result.outcomes.filter((o) => !o.ok);
    expect(failed.map((o) => (o.ok ? "" : o.message))).toEqual([
      "El PDF supera el tamaño máximo de 20 MB.",
      "Solo puedes subir archivos PDF.",
    ]);
  });

  it("does nothing when every file is invalid", async () => {
    const { deps } = makeDeps();
    const result = await runUploadBatch([{ name: "x.txt", size: 1, type: "text/plain" }], deps);
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]).toMatchObject({ ok: false });
    expect(deps.checkBatchCapacity).not.toHaveBeenCalled();
    expect(deps.resolveBookId).not.toHaveBeenCalled();
  });

  it("stops with the product error and uploads nothing when the product cannot be resolved", async () => {
    const { deps } = makeDeps({
      resolveBookId: vi.fn(async () => ({ ok: false, message: "Escribe un nombre para el producto." }) as const),
    });
    const result = await runUploadBatch([pdf("a.pdf")], deps);
    expect(result.batchError).toBe("Escribe un nombre para el producto.");
    expect(deps.requestUpload).not.toHaveBeenCalled();
  });

  it("isolates a failing file: the others still upload", async () => {
    const { deps, calls } = makeDeps({
      putFile: vi.fn(async (prepared) => {
        calls.push(`put:${prepared.uploadId}`);
        return prepared.uploadId === "up-b.pdf" ? ({ ok: false } as const) : ({ ok: true } as const);
      }),
    });
    const result = await runUploadBatch([pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")], deps);
    expect(result.outcomes.map((o) => o.ok)).toEqual([true, false, true]);
    expect(calls).not.toContain("confirm:up-b.pdf");
    expect(calls).toContain("confirm:up-c.pdf");
    const bad = result.outcomes[1]!;
    expect(bad.ok ? "" : bad.message).toMatch(/No pudimos subir el archivo/);
  });

  it("reports a rejected request or confirm per file with the server message and plan flag", async () => {
    const { deps } = makeDeps({
      requestUpload: vi.fn(async (input) =>
        input.name === "a.pdf"
          ? ({ ok: false, reason: "subscription_required", message: "Necesitas una suscripción activa para subir PDF." } as const)
          : ({ ok: true, uploadId: "up-b", path: "s/b", signedUrl: "u", token: "t", activeCount: 1 } as const),
      ),
      confirmUpload: vi.fn(async () => ({ ok: false, message: "No encontramos el archivo subido.", code: "subscription_required" }) as const),
    });
    const result = await runUploadBatch([pdf("a.pdf"), pdf("b.pdf")], deps);
    expect(result.outcomes[0]).toEqual({
      name: "a.pdf", ok: false, message: "Necesitas una suscripción activa para subir PDF.", needsPlan: true,
    });
    expect(result.outcomes[1]).toEqual({
      name: "b.pdf", ok: false, message: "No encontramos el archivo subido.", needsPlan: true,
    });
  });

  it("turns an unexpected throw into a per-file error and keeps going", async () => {
    let n = 0;
    const { deps } = makeDeps({
      requestUpload: vi.fn(async (input) => {
        if (n++ === 0) throw new Error("network");
        return { ok: true, uploadId: `up-${input.name}`, path: "p", signedUrl: "u", token: "t", activeCount: 1 } as const;
      }),
    });
    const result = await runUploadBatch([pdf("a.pdf"), pdf("b.pdf")], deps);
    expect(result.outcomes.map((o) => o.ok)).toEqual([false, true]);
  });
});
