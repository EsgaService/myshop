"use client";

import { useActionState } from "react";
import { updateBookDetails, type BookActionState } from "@/app/vendedor/(panel)/productos/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

type Values = { title: string; tagline: string; description: string };

export function BookDetailsForm({ bookId, initial }: { bookId: string; initial: Values }) {
  const [state, action, pending] = useActionState<BookActionState, FormData>(updateBookDetails, { status: "idle" });
  const errors = state.errors ?? {};

  return (
    <form action={action} className="max-w-lg space-y-5">
      <input type="hidden" name="bookId" value={bookId} />
      <Field label="Título" htmlFor="title" error={errors.title}>
        <Input id="title" name="title" defaultValue={initial.title} maxLength={120} required />
      </Field>
      <Field label="Subtítulo (opcional)" htmlFor="tagline" error={errors.tagline}>
        <Input id="tagline" name="tagline" defaultValue={initial.tagline} maxLength={160} />
      </Field>
      <Field label="Descripción (opcional)" htmlFor="description" error={errors.description}>
        <textarea
          id="description"
          name="description"
          defaultValue={initial.description}
          maxLength={2000}
          rows={6}
          className="w-full rounded-xl border border-border-strong bg-surface px-4 py-3 text-sm text-fg focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </Field>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</Button>
        {state.status === "saved" && <p role="status" className="text-sm text-success">Cambios guardados.</p>}
        {state.status === "error" && state.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      </div>
    </form>
  );
}
