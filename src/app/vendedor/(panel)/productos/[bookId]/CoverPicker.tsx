"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmCoverUpload, setCover } from "@/app/vendedor/(panel)/productos/image-actions";
import { Button } from "@/components/ui/Button";
import { photoUrl } from "@/lib/format";
import { CustomImageUpload } from "./CustomImageUpload";
import { ImageGrid, type GridImage } from "./ImageGrid";

export type CoverOption = { id: string; kind: "pdf" | "custom"; storagePath: string; thumbPath: string; label: string };

type Draft = { kind: "candidate" | "custom"; id: string; path: string } | { kind: "clear" } | null;

/**
 * Cover picker: choose among the product's PDF images or your own uploads, or clear it. Choosing only updates the
 * preview (`onPreview`); "Guardar portada" persists it. Uploading your own image applies it right away.
 */
export function CoverPicker({
  bookId,
  options,
  savedPath,
  onPreview,
  onSaved,
}: {
  bookId: string;
  options: CoverOption[];
  /** The persisted `books.cover_url` (storage path), or null. */
  savedPath: string | null;
  onPreview: (path: string | null) => void;
  onSaved: (path: string | null) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const savedOption = options.find((o) => o.storagePath === savedPath) ?? null;
  const selectedId = draft === null ? (savedOption?.id ?? null) : draft.kind === "clear" ? null : draft.id;
  const pdfImages: GridImage[] = options.filter((o) => o.kind === "pdf").map(toGrid);
  const customImages: GridImage[] = options.filter((o) => o.kind === "custom").map(toGrid);

  function toGrid(o: CoverOption): GridImage {
    return { id: o.id, thumbUrl: photoUrl(o.thumbPath) ?? "", label: o.label };
  }

  function choose(id: string) {
    const option = options.find((o) => o.id === id);
    if (!option) return;
    setMessage(null);
    setDraft({ kind: option.kind === "pdf" ? "candidate" : "custom", id: option.id, path: option.storagePath });
    onPreview(option.storagePath);
  }

  function clear() {
    setMessage(null);
    setDraft({ kind: "clear" });
    onPreview(null);
  }

  function save() {
    if (!draft) return;
    const choice = draft.kind === "clear" ? { type: "clear" } : { type: draft.kind, imageId: draft.id };
    startTransition(async () => {
      const result = await setCover(bookId, choice);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.message });
        return;
      }
      setDraft(null);
      onSaved(draft.kind === "clear" ? null : draft.path);
      setMessage({ tone: "ok", text: "Portada guardada." });
      router.refresh();
    });
  }

  const dirty = draft !== null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Imágenes de tus PDF</h3>
        <ImageGrid
          images={pdfImages}
          selectedId={selectedId}
          onSelect={choose}
          disabled={pending}
          emptyText="Todavía no hay imágenes de tus PDF. Aparecen aquí cuando termina su procesamiento."
        />
      </div>

      {customImages.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Tus imágenes</h3>
          <ImageGrid images={customImages} selectedId={selectedId} onSelect={choose} disabled={pending} emptyText="" />
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <CustomImageUpload
          confirm={(path) => confirmCoverUpload(bookId, path)}
          onDone={(result) => {
            setDraft(null);
            onSaved(result.coverUrl ?? null);
            setMessage({ tone: "ok", text: "Portada guardada." });
            router.refresh();
          }}
        />
        {(savedPath !== null || (draft !== null && draft.kind !== "clear")) && (
          <Button variant="ghost" disabled={pending} onClick={clear}>
            Quitar portada
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!dirty || pending} onClick={save}>
          {pending ? "Guardando…" : "Guardar portada"}
        </Button>
        {dirty && !pending && <p className="text-xs text-fg-muted">Cambios sin guardar. La vista previa ya los muestra.</p>}
        {message && (
          <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-danger" : "text-sm text-success"}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
