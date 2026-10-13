"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveUpload } from "@/app/vendedor/(panel)/productos/actions";
import { MoveUploadForm, type MoveTarget } from "./MoveUploadForm";

/** Moves one READY PDF to another product of the seller. The server re-checks everything (R2, ownership, plan). */
export function MoveUploadControl({ uploadId, targets }: { uploadId: string; targets: MoveTarget[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsPlan, setNeedsPlan] = useState(false);

  function move() {
    const target = targets.find((t) => t.id === targetId);
    if (!target) return;
    if (
      !window.confirm(
        `Las recetas de este PDF saldrán de este producto y pasarán a «${target.title}». Quienes ya compraron este producto dejarán de verlas aquí y el PDF dejará de aparecer en sus descargas. ¿Continuar?`,
      )
    ) {
      return;
    }
    setError(null);
    setNeedsPlan(false);
    startTransition(async () => {
      const result = await moveUpload(uploadId, target.id);
      if (!result.ok) {
        setError(result.message);
        setNeedsPlan(result.code === "subscription_required");
        return;
      }
      // The PDF now renders under its new product; if the origin is left empty it shows the delete hint.
      router.refresh();
    });
  }

  return (
    <MoveUploadForm
      uploadId={uploadId}
      targets={targets}
      value={targetId}
      pending={pending}
      onChange={setTargetId}
      onMove={move}
      feedback={
        error && (
          <p role="alert" className="text-xs text-danger">
            {error}
            {needsPlan && (
              <>
                {" "}
                <Link href="/vendedor/suscripcion" className="font-medium underline">
                  Activa tu suscripción
                </Link>
                .
              </>
            )}
          </p>
        )
      }
    />
  );
}
