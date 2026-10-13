"use client";

import { useState, useTransition } from "react";
import { confirmRecipeImageUpload, setRecipePhoto } from "@/app/vendedor/(panel)/productos/image-actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { photoUrl } from "@/lib/format";
import { describeRecipePhoto, type PhotoSource } from "@/lib/images/describe-recipe-photo";
import { CustomImageUpload } from "../CustomImageUpload";
import { ImagePicker } from "./ImagePicker";

/** One recipe with its current photo: pick another PDF image, upload your own, or remove it. */
export function RecipePhotoRow({
  recipeId,
  title,
  photoPath: initialPath,
  photoSource: initialSource,
}: {
  recipeId: string;
  title: string;
  photoPath: string | null;
  photoSource: PhotoSource;
}) {
  const [photoPath, setPhotoPath] = useState(initialPath);
  const [photoSource, setPhotoSource] = useState<PhotoSource>(initialSource);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const state = describeRecipePhoto({ photoPath, photoSource });
  const url = photoUrl(photoPath);

  function apply(choice: { type: "candidate"; imageId: string } | { type: "remove" }) {
    setMessage(null);
    startTransition(async () => {
      const result = await setRecipePhoto(recipeId, choice);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setPhotoPath(result.photoPath);
      setPhotoSource(choice.type === "remove" ? "none" : "pdf");
      if (choice.type === "candidate") setOpen(false);
    });
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-muted">
          {state.hasPhoto && url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Foto de ${title}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-[11px] text-fg-muted">Sin foto</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{title}</p>
          <p className="text-xs text-fg-muted">{state.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-9 px-4" aria-expanded={open} disabled={pending} onClick={() => setOpen((v) => !v)}>
            {open ? "Cerrar" : "Cambiar foto"}
          </Button>
          {state.hasPhoto && (
            <Button variant="ghost" className="h-9 px-4" disabled={pending} onClick={() => apply({ type: "remove" })}>
              Quitar foto
            </Button>
          )}
        </div>
      </div>

      {message && <p role="alert" className="text-sm text-danger">{message}</p>}

      {open && (
        <div className="space-y-4 border-t border-border pt-4">
          <ImagePicker recipeId={recipeId} selectedId={null} disabled={pending} onPick={(imageId) => apply({ type: "candidate", imageId })} />
          <CustomImageUpload
            confirm={(path) => confirmRecipeImageUpload(recipeId, path)}
            onDone={(result) => {
              setPhotoPath(result.photoPath);
              setPhotoSource("custom");
              setOpen(false);
            }}
          />
        </div>
      )}
    </Card>
  );
}
