"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { subscribe, type SubscribeState } from "./actions";

export function SubscribeForm({ label, disabled }: { label: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<SubscribeState>(subscribe, { status: "idle" });
  return (
    <form action={action} className="flex flex-wrap items-center gap-4">
      <Button type="submit" size="lg" disabled={pending || disabled}>
        {pending ? "Procesando pago…" : label}
      </Button>
      {state.status === "saved" && <p role="status" className="text-sm text-success">Pago recibido. Tu suscripción está activa.</p>}
      {state.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
