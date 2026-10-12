"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { updateBuyerProfile, type ProfileFormState } from "./actions";

type Values = { displayName: string; phone: string; city: string };

export function ProfileForm({ initial, email }: { initial: Values; email: string }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(updateBuyerProfile, { status: "idle" });
  const errors = state.errors ?? {};

  return (
    <form action={action} className="mt-6 max-w-lg space-y-5">
      <Field label="Correo" htmlFor="email" hint="Es el correo de tu cuenta de Google.">
        <Input id="email" value={email} readOnly disabled />
      </Field>
      <Field label="Nombre" htmlFor="displayName" error={errors.displayName}>
        <Input id="displayName" name="displayName" defaultValue={initial.displayName} maxLength={80} required />
      </Field>
      <Field label="Teléfono (opcional)" htmlFor="phone" error={errors.phone}>
        <Input id="phone" name="phone" defaultValue={initial.phone} inputMode="tel" autoComplete="tel" />
      </Field>
      <Field label="Ciudad (opcional)" htmlFor="city" error={errors.city}>
        <Input id="city" name="city" defaultValue={initial.city} maxLength={80} />
      </Field>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</Button>
        {state.status === "saved" && <p role="status" className="text-sm text-success">Perfil actualizado.</p>}
        {state.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      </div>
    </form>
  );
}
