"use client";

import { useActionState } from "react";
import { setBookPrice, type BookActionState } from "@/app/vendedor/(panel)/productos/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

const pesos = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/** Price in whole COP. The server parses and bounds it again: this input is only a convenience. */
export function PriceEditor({ bookId, priceCents }: { bookId: string; priceCents: number }) {
  const [state, action, pending] = useActionState<BookActionState, FormData>(setBookPrice, { status: "idle" });
  const id = `price-${bookId}`;

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="bookId" value={bookId} />
      <label htmlFor={id} className="block text-sm font-medium">Precio (COP)</label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          name="price"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={priceCents > 0 ? pesos.format(priceCents / 100) : ""}
          placeholder="19.900"
          className="h-10 w-40 font-mono"
          aria-describedby={`${id}-msg`}
        />
        <Button type="submit" variant="outline" disabled={pending} className="h-10 px-4">
          {pending ? "Guardando…" : "Guardar precio"}
        </Button>
      </div>
      <p id={`${id}-msg`} role={state.status === "error" ? "alert" : "status"} className={`text-xs ${state.status === "error" ? "text-danger" : "text-success"}`}>
        {state.message}
      </p>
    </form>
  );
}
