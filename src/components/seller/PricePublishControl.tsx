"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  publishBook,
  setBookPrice,
  unpublishBook,
  type BookActionState,
} from "@/app/vendedor/(panel)/productos/actions";
import { Button } from "@/components/ui/Button";
import { PriceField } from "./PriceField";

const IDLE: BookActionState = { status: "idle" };

/**
 * One form per product: the price field plus "Guardar precio" and "Publicar"/"Despublicar". Both buttons
 * submit the price on screen, so publishing never depends on a separate save. The server validates it.
 */
export function PricePublishControl({ bookId, priceCents, published }: { bookId: string; priceCents: number; published: boolean }) {
  const [priceState, savePrice, savingPrice] = useActionState<BookActionState, FormData>(setBookPrice, IDLE);
  const [publishState, togglePublish, toggling] = useActionState<BookActionState, FormData>(
    published ? unpublishBook : publishBook,
    IDLE,
  );
  const id = `price-${bookId}`;
  const busy = savingPrice || toggling;
  const hasPrice = priceCents > 0;

  return (
    <form className="space-y-1.5">
      <input type="hidden" name="bookId" value={bookId} />
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium">Precio (COP)</label>
        {!hasPrice && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-fg-muted">Sin precio</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PriceField id={id} initialCents={priceCents} disabled={busy} describedBy={`${id}-msg`} />
        <Button type="submit" formAction={savePrice} variant="outline" disabled={busy} className="h-10 px-4">
          {savingPrice ? "Guardando…" : "Guardar precio"}
        </Button>
        <Button type="submit" formAction={togglePublish} variant={published ? "outline" : "primary"} disabled={busy} className="h-10">
          {toggling ? "Un momento…" : published ? "Despublicar" : "Publicar"}
        </Button>
      </div>
      <div id={`${id}-msg`} className="space-y-1">
        {priceState.message && (
          <p role={priceState.status === "error" ? "alert" : "status"} className={`text-xs ${priceState.status === "error" ? "text-danger" : "text-success"}`}>
            {priceState.message}
          </p>
        )}
        {publishState.status === "error" && (
          <p role="alert" className="max-w-sm text-xs text-danger">
            {publishState.message}{" "}
            {publishState.code === "subscription_required" && (
              <Link href="/vendedor/suscripcion" className="font-medium underline">
                Activar suscripción
              </Link>
            )}
          </p>
        )}
        {publishState.status === "saved" && publishState.message && (
          <p role="status" className="text-xs text-success">{publishState.message}</p>
        )}
      </div>
    </form>
  );
}
