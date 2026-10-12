"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { updateSellerProfile, type SellerProfileFormState } from "./actions";

type Values = {
  storeName: string;
  slug: string;
  bio: string;
  city: string;
  instagram: string;
  whatsapp: string;
};

export function SellerProfileForm({ initial, email, slugLocked }: { initial: Values; email: string; slugLocked: boolean }) {
  const [state, action, pending] = useActionState<SellerProfileFormState, FormData>(updateSellerProfile, { status: "idle" });
  const errors = state.errors ?? {};

  return (
    <form action={action} className="mt-6 max-w-lg space-y-5">
      <Field label="Correo" htmlFor="email" hint="Es el correo de tu cuenta de Google.">
        <Input id="email" value={email} readOnly disabled />
      </Field>
      <Field label="Nombre de la tienda" htmlFor="storeName" error={errors.storeName}>
        <Input id="storeName" name="storeName" defaultValue={initial.storeName} maxLength={80} required />
      </Field>
      <Field
        label="Enlace de tu tienda"
        htmlFor="slug"
        hint={
          slugLocked
            ? "No se puede cambiar mientras tengas recetarios publicados, porque los enlaces que ya compartiste dejarían de funcionar."
            : "Aparece en la dirección de tu tienda. Si lo cambias, los enlaces que ya compartiste dejarán de funcionar."
        }
        error={errors.slug}
      >
        <Input
          id="slug"
          name="slug"
          defaultValue={initial.slug}
          maxLength={40}
          required
          readOnly={slugLocked}
          autoCapitalize="none"
          spellCheck={false}
        />
      </Field>
      <Field label="Descripción (opcional)" htmlFor="bio" error={errors.bio}>
        <textarea
          id="bio"
          name="bio"
          defaultValue={initial.bio}
          maxLength={500}
          rows={4}
          className="w-full rounded-xl border border-border-strong bg-surface px-4 py-3 text-sm text-fg focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </Field>
      <Field label="Ciudad (opcional)" htmlFor="city" error={errors.city}>
        <Input id="city" name="city" defaultValue={initial.city} maxLength={80} />
      </Field>
      <Field label="Instagram (opcional)" htmlFor="instagram" error={errors.instagram}>
        <Input id="instagram" name="instagram" defaultValue={initial.instagram} placeholder="@tutienda" autoCapitalize="none" />
      </Field>
      <Field label="WhatsApp (opcional)" htmlFor="whatsapp" error={errors.whatsapp}>
        <Input id="whatsapp" name="whatsapp" defaultValue={initial.whatsapp} inputMode="tel" autoComplete="tel" />
      </Field>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</Button>
        {state.status === "saved" && <p role="status" className="text-sm text-success">Perfil actualizado.</p>}
        {state.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      </div>
    </form>
  );
}
