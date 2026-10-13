"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reextractUpload } from "@/app/vendedor/(panel)/productos/image-actions";
import { Button } from "@/components/ui/Button";

/** Asks for the PDF's images to be searched again. Photos you chose yourself are kept. */
export function ReextractButton({ uploadId }: { uploadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        className="h-9 px-4"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await reextractUpload(uploadId);
            setMessage(
              result.ok
                ? { tone: "ok", text: "Buscaremos las imágenes de nuevo. Las fotos que elegiste se mantienen." }
                : { tone: "error", text: result.message },
            );
            if (result.ok) router.refresh();
          })
        }
      >
        {pending ? "Enviando…" : "Buscar imágenes de nuevo"}
      </Button>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-xs text-danger" : "text-xs text-fg-muted"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
