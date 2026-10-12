"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { confirmUpload, requestUpload } from "@/app/vendedor/(panel)/productos/actions";
import { Button } from "@/components/ui/Button";
import { checkUpload, MAX_UPLOADS_PER_SELLER } from "@/lib/books/upload-limit";
import { uploadErrorMessage } from "@/lib/books/request-upload-core";
import { createClient } from "@/lib/supabase/client";

type Phase = "idle" | "preparing" | "uploading" | "confirming";

/**
 * PDF picker. Flow: server action validates and returns a signed URL -> the browser
 * uploads straight to the private bucket -> server action verifies and enqueues the job.
 * The checks here are UX only; the server re-validates everything.
 */
export function UploadDropzone({ activeCount }: { activeCount: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const full = activeCount >= MAX_UPLOADS_PER_SELLER;
  const busy = phase !== "idle";

  async function handle(file: File) {
    setError(null);
    const precheck = checkUpload({ activeCount, size: file.size, mime: file.type, name: file.name });
    if (!precheck.ok) {
      setError(uploadErrorMessage(precheck.reason));
      return;
    }

    try {
      setPhase("preparing");
      const prepared = await requestUpload({ name: file.name, size: file.size, mime: file.type });
      if (!prepared.ok) {
        setError(prepared.message);
        return;
      }

      setPhase("uploading");
      const { error: uploadError } = await createClient()
        .storage.from("seller-pdfs")
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: "application/pdf" });
      if (uploadError) {
        setError("No pudimos subir el archivo. Inténtalo de nuevo; si queda en la lista como incompleto, elimínalo.");
        router.refresh();
        return;
      }

      setPhase("confirming");
      const confirmed = await confirmUpload(prepared.uploadId);
      if (!confirmed.ok) setError(confirmed.message);
      router.refresh();
    } catch {
      setError("Ocurrió un error inesperado. Inténtalo de nuevo.");
    } finally {
      setPhase("idle");
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!full && !busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && !full && !busy) void handle(file);
        }}
        className={`rounded-card border border-dashed p-8 text-center transition-colors ${
          dragging ? "border-primary bg-primary-soft" : "border-border-strong bg-surface"
        } ${full ? "opacity-60" : ""}`}
      >
        <p className="font-display text-xl font-semibold">Sube un PDF de recetas</p>
        <p className="mt-1 text-sm text-fg-muted">
          Cada PDF se convierte en un recetario. Solo PDF, máximo 20 MB.{" "}
          <span className="font-mono">{activeCount}/{MAX_UPLOADS_PER_SELLER}</span> subidos.
        </p>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          id="pdf-input"
          disabled={full || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handle(file);
          }}
        />
        <Button className="mt-4" disabled={full || busy} onClick={() => input.current?.click()}>
          {phase === "preparing" && "Preparando…"}
          {phase === "uploading" && "Subiendo…"}
          {phase === "confirming" && "Enviando a la IA…"}
          {phase === "idle" && "Elegir PDF"}
        </Button>
        {full && <p className="mt-3 text-sm text-fg-muted">Llegaste al máximo de {MAX_UPLOADS_PER_SELLER} PDF.</p>}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
