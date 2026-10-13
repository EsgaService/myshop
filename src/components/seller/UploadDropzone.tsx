"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { MAX_UPLOADS_PER_SELLER } from "@/lib/books/upload-limit";

/**
 * Presentational multi-file PDF picker: it only emits the files the seller chose (picker or drop).
 * Validation, upload and persistence live in `ProductUploader`.
 */
export function UploadDropzone({
  activeCount,
  disabled,
  busy,
  busyLabel,
  onFiles,
}: {
  activeCount: number;
  disabled: boolean;
  busy: boolean;
  busyLabel: string;
  onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const blocked = disabled || busy;

  function emit(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (files.length > 0) onFiles(files);
    if (input.current) input.current.value = "";
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!blocked) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!blocked) emit(e.dataTransfer.files);
      }}
      className={`rounded-card border border-dashed p-8 text-center transition-colors ${
        dragging ? "border-primary bg-primary-soft" : "border-border-strong bg-surface"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <p className="font-display text-xl font-semibold">Sube uno o varios PDF de recetas</p>
      <p className="mt-1 text-sm text-fg-muted">
        Todos los PDF que subas a un producto se unen en un solo recetario. Solo PDF, máximo 20 MB cada uno.{" "}
        <span className="font-mono">{activeCount}/{MAX_UPLOADS_PER_SELLER}</span> subidos.
      </p>
      <input
        ref={input}
        type="file"
        multiple
        accept="application/pdf,.pdf"
        className="sr-only"
        id="pdf-input"
        disabled={blocked}
        onChange={(e) => emit(e.target.files)}
      />
      <Button className="mt-4" disabled={blocked} onClick={() => input.current?.click()}>
        {busy ? busyLabel : "Elegir PDF"}
      </Button>
    </div>
  );
}
