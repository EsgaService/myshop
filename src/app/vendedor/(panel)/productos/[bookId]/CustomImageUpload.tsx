"use client";

import { useRef, useState } from "react";
import {
  requestImageUpload,
  type ImageActionResult,
} from "@/app/vendedor/(panel)/productos/image-actions";
import { Button } from "@/components/ui/Button";
import { CUSTOM_IMAGE_MAX_BYTES, customImageErrorMessage } from "@/lib/images/validate-custom-image";
import { createClient } from "@/lib/supabase/client";

const TEMP_BUCKET = "seller-image-uploads";

/**
 * "Upload your own image": signed upload to the private temp bucket, then `confirm` (a server action bound to
 * a cover or a recipe) validates by magic bytes, re-encodes to WebP and applies it. The file type the
 * browser reports is never trusted; it only has to be an image for the picker.
 */
export function CustomImageUpload({
  confirm,
  onDone,
  label = "Subir mi propia imagen",
}: {
  confirm: (tempPath: string) => Promise<ImageActionResult>;
  onDone: (result: Extract<ImageActionResult, { ok: true }>) => void;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File) {
    setError(null);
    if (file.size > CUSTOM_IMAGE_MAX_BYTES) {
      setError(customImageErrorMessage("too_large"));
      return;
    }
    setBusy(true);
    try {
      const prepared = await requestImageUpload({ size: file.size });
      if (!prepared.ok) {
        setError(prepared.message);
        return;
      }
      const { error: uploadError } = await createClient()
        .storage.from(TEMP_BUCKET)
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type || "image/jpeg" });
      if (uploadError) {
        setError("No pudimos subir la imagen. Inténtalo de nuevo.");
        return;
      }
      const result = await confirm(prepared.path);
      if (!result.ok) setError(result.message);
      else onDone(result);
    } catch {
      setError("No pudimos subir la imagen. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={label}
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handle(file);
        }}
      />
      <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Subiendo…" : label}
      </Button>
      <p className="text-xs text-fg-muted">JPG, PNG o WebP, máximo 5 MB.</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
