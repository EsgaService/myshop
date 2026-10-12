"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  checkBatchCapacity,
  confirmUpload,
  createProduct,
  requestUpload,
} from "@/app/vendedor/(panel)/productos/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { resolveOptionalPrice, priceErrorMessage } from "@/lib/books/price";
import { MAX_PRODUCT_NAME_LENGTH, parseProductName, productNameErrorMessage } from "@/lib/books/product-name";
import { MAX_UPLOADS_PER_SELLER } from "@/lib/books/upload-limit";
import { runUploadBatch, type FileOutcome } from "@/lib/ingestion/upload-batch";
import { createClient } from "@/lib/supabase/client";
import { PriceField } from "./PriceField";
import { UploadDropzone } from "./UploadDropzone";

const NEW_PRODUCT = "new";

export type UploaderProduct = { id: string; title: string };

type FileLine = { name: string; state: "waiting" | "uploading" | "done" | "error"; message?: string };

/**
 * Container for the multi-file upload: picks the target product (an existing one or a new one named
 * here), then runs the batch pipeline. Every file gets its own line with its own result (R1.2, R1.3, R1.7).
 */
export function ProductUploader({
  products,
  slotsHeld,
  canUpload,
}: {
  products: UploaderProduct[];
  slotsHeld: number;
  canUpload: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<string>(products[0]?.id ?? NEW_PRODUCT);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [priceKey, setPriceKey] = useState(0);
  const [created, setCreated] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<FileLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [needsPlan, setNeedsPlan] = useState(false);

  const creating = target === NEW_PRODUCT;
  const full = slotsHeld >= MAX_UPLOADS_PER_SELLER;
  const disabled = !canUpload || full;

  /** Name and optional price of a new product, validated for the UI (the server validates again). */
  function checkNewProduct(): boolean {
    const parsed = parseProductName(newName);
    if (!parsed.ok) {
      setError(productNameErrorMessage(parsed.reason));
      return false;
    }
    const price = resolveOptionalPrice(newPrice);
    if (!price.ok) {
      setError(priceErrorMessage(price.reason));
      return false;
    }
    return true;
  }

  function resetNewProduct() {
    setNewName("");
    setNewPrice("");
    setPriceKey((k) => k + 1);
  }

  /** Creates an empty draft (name and optional price); PDFs can be added afterwards. */
  async function handleCreateEmpty() {
    setError(null);
    setNeedsPlan(false);
    setCreated(null);
    if (!checkNewProduct()) return;
    setRunning(true);
    try {
      const result = await createProduct(newName, newPrice);
      if (!result.ok) {
        setError(result.message);
        setNeedsPlan(result.code === "subscription_required");
        return;
      }
      setCreated(`Producto «${newName.trim()}» creado. Ya puedes subirle PDF o añadirle PDF existentes.`);
      resetNewProduct();
      setTarget(result.bookId);
      router.refresh();
    } catch {
      setError("Ocurrió un error inesperado. Inténtalo de nuevo.");
    } finally {
      setRunning(false);
    }
  }

  async function handleFiles(files: File[]) {
    setError(null);
    setNeedsPlan(false);
    setCreated(null);

    if (creating && !checkNewProduct()) return;

    setRunning(true);
    setLines(files.map((f) => ({ name: f.name, state: "waiting" })));
    try {
      const result = await runUploadBatch(files, {
        checkBatchCapacity,
        async resolveBookId() {
          if (!creating) return { ok: true, bookId: target };
          const result = await createProduct(newName, newPrice);
          if (!result.ok) {
            setNeedsPlan(result.code === "subscription_required");
            return { ok: false, message: result.message };
          }
          return { ok: true, bookId: result.bookId };
        },
        requestUpload,
        async putFile(prepared, file) {
          const { error: uploadError } = await createClient()
            .storage.from("seller-pdfs")
            .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: "application/pdf" });
          return uploadError ? { ok: false } : { ok: true };
        },
        confirmUpload,
        onProgress(index, phase, outcome) {
          setLines((current) =>
            current.map((line, i) => (i === index ? lineFor(line.name, phase, outcome) : line)),
          );
        },
      });

      if (result.batchError) {
        setLines([]);
        setError(result.batchError);
        return;
      }
      // Files rejected before the pipeline (type/size) never got a progress event: show their outcome.
      setLines(result.outcomes.map((o) => lineFor(o.name, "done", o)));
      setNeedsPlan(result.outcomes.some((o) => !o.ok && o.needsPlan));
      if (creating && result.outcomes.some((o) => o.ok)) resetNewProduct();
      router.refresh();
    } catch {
      setError("Ocurrió un error inesperado. Inténtalo de nuevo.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="upload-target" className="block text-sm font-medium text-fg">Producto de destino</label>
          <select
            id="upload-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={running}
            className="h-11 w-full rounded-xl border border-border-strong bg-surface px-4 text-sm text-fg focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
            <option value={NEW_PRODUCT}>Nuevo producto</option>
          </select>
        </div>
        {creating && (
          <div className="space-y-1.5">
            <label htmlFor="new-product-name" className="block text-sm font-medium text-fg">Nombre del producto nuevo</label>
            <Input
              id="new-product-name"
              value={newName}
              maxLength={MAX_PRODUCT_NAME_LENGTH}
              placeholder="Ejemplo: Cocteles de verano"
              disabled={running}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
        )}
      </div>

      {creating && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="new-product-price" className="block text-sm font-medium text-fg">
              Precio en COP <span className="font-normal text-fg-muted">(opcional)</span>
            </label>
            <PriceField
              key={priceKey}
              id="new-product-price"
              name="newPrice"
              disabled={running}
              onValueChange={setNewPrice}
            />
          </div>
          <Button variant="outline" className="h-10 px-4" disabled={running || !canUpload} onClick={() => void handleCreateEmpty()}>
            Crear producto sin PDF
          </Button>
        </div>
      )}

      <UploadDropzone
        activeCount={slotsHeld}
        disabled={disabled}
        busy={running}
        busyLabel="Subiendo…"
        onFiles={(files) => void handleFiles(files)}
      />

      {created && (
        <p role="status" className="text-sm text-success">
          {created}
        </p>
      )}
      {full && <p className="text-sm text-fg-muted">Llegaste al máximo de {MAX_UPLOADS_PER_SELLER} PDF.</p>}
      {!canUpload && (
        <p className="text-sm text-fg-muted">
          Necesitas una suscripción activa para subir PDF. <SubscribeLink />
        </p>
      )}

      {lines.length > 0 && (
        <ul className="space-y-1.5 text-sm" aria-live="polite">
          {lines.map((line, i) => (
            <li key={`${i}-${line.name}`} className="flex flex-wrap gap-x-2">
              <span className="font-medium">{line.name}</span>
              <span className={line.state === "error" ? "text-danger" : "text-fg-muted"}>{lineText(line)}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
          {needsPlan && <SubscribeLink />}
        </p>
      )}
      {!error && needsPlan && (
        <p className="text-sm text-danger">
          <SubscribeLink />
        </p>
      )}
    </div>
  );
}

function lineFor(name: string, phase: "uploading" | "done", outcome?: FileOutcome): FileLine {
  if (phase === "uploading") return { name, state: "uploading" };
  if (outcome && !outcome.ok) return { name, state: "error", message: outcome.message };
  return { name, state: "done" };
}

function lineText(line: FileLine): string {
  switch (line.state) {
    case "waiting":
      return "En espera";
    case "uploading":
      return "Subiendo…";
    case "done":
      return "Enviado a la IA";
    case "error":
      return line.message ?? "No se pudo subir";
  }
}

function SubscribeLink() {
  return (
    <>
      {" "}
      <Link href="/vendedor/suscripcion" className="font-medium underline">
        Activa tu suscripción
      </Link>
      .
    </>
  );
}
