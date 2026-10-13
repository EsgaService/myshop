"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProduct } from "@/app/vendedor/(panel)/productos/actions";
import { Button } from "@/components/ui/Button";

/** Deletes an empty draft product. The server decides whether it is allowed (R5.2). */
export function DeleteProductButton({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!window.confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteProduct(bookId);
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant="ghost" className="h-9 px-4" disabled={pending} onClick={remove}>
        {pending ? "Eliminando…" : "Eliminar producto"}
      </Button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
