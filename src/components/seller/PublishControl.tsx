"use client";

import Link from "next/link";
import { useActionState } from "react";
import { publishBook, unpublishBook, type BookActionState } from "@/app/vendedor/(panel)/productos/actions";
import { Button } from "@/components/ui/Button";

/** Publish or unpublish. Publishing is gated server-side by the subscription; the CTA shows when refused. */
export function PublishControl({ bookId, published }: { bookId: string; published: boolean }) {
  const [state, action, pending] = useActionState<BookActionState, FormData>(published ? unpublishBook : publishBook, { status: "idle" });

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="bookId" value={bookId} />
      <Button type="submit" variant={published ? "outline" : "primary"} disabled={pending} className="h-10">
        {pending ? "Un momento…" : published ? "Despublicar" : "Publicar"}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="max-w-xs text-xs text-danger">
          {state.message}{" "}
          {state.code === "subscription_required" && (
            <Link href="/vendedor/suscripcion" className="font-medium underline">
              Activar suscripción
            </Link>
          )}
        </p>
      )}
      {state.status === "saved" && state.message && <p role="status" className="text-xs text-success">{state.message}</p>}
    </form>
  );
}
