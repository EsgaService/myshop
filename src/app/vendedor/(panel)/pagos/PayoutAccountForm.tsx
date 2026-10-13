"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { DOCUMENT_TYPES, PAYOUT_BANKS, PAYOUT_WALLETS, type PayoutMethod } from "@/lib/seller/payout-account";
import type { SavedPayoutAccount } from "@/lib/seller/payout-store";
import { savePayoutAccount, type PayoutFormState } from "./actions";

const select =
  "h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-fg focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

const ACCOUNT_TYPES = { savings: "Ahorros", checking: "Corriente" } as const;

export function PayoutAccountForm({ saved }: { saved: SavedPayoutAccount | null }) {
  const [state, action, pending] = useActionState<PayoutFormState, FormData>(savePayoutAccount, { status: "idle" });
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState<PayoutMethod>(saved?.method ?? "bank");
  const errors = state.errors ?? {};
  const showSummary = saved && !editing && state.status !== "error";

  if (showSummary) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-semibold">{saved.institution}</h2>
          <Badge tone="success">Guardada</Badge>
        </div>
        <dl className="space-y-1 text-sm">
          <div className="flex gap-2"><dt className="text-fg-muted">{saved.method === "bank" ? "Cuenta" : "Celular"}:</dt><dd className="font-mono">{saved.maskedAccountNumber}</dd></div>
          {saved.accountType && <div className="flex gap-2"><dt className="text-fg-muted">Tipo:</dt><dd>{ACCOUNT_TYPES[saved.accountType]}</dd></div>}
          <div className="flex gap-2"><dt className="text-fg-muted">Titular:</dt><dd>{saved.holderName}</dd></div>
          <div className="flex gap-2"><dt className="text-fg-muted">Documento:</dt><dd className="font-mono">{saved.documentType} {saved.maskedDocumentNumber}</dd></div>
        </dl>
        {state.status === "saved" && <p role="status" className="text-sm text-success">Cuenta actualizada.</p>}
        <Button type="button" variant="outline" onClick={() => setEditing(true)}>Editar cuenta</Button>
      </div>
    );
  }

  const institutions = method === "bank" ? PAYOUT_BANKS : PAYOUT_WALLETS;

  return (
    <form action={action} className="space-y-5" autoComplete="off">
      <Field label="¿Dónde quieres recibir?" htmlFor="method" error={errors.method}>
        <select id="method" name="method" className={select} value={method} onChange={(e) => setMethod(e.target.value as PayoutMethod)}>
          <option value="bank">Cuenta bancaria</option>
          <option value="wallet">Billetera digital</option>
        </select>
      </Field>
      <Field label={method === "bank" ? "Banco" : "Billetera"} htmlFor="institution" error={errors.institution}>
        <select id="institution" name="institution" className={select} defaultValue={saved?.method === method ? saved.institution : ""} key={method} required>
          <option value="" disabled>Elige una opción</option>
          {institutions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </Field>
      {method === "bank" && (
        <Field label="Tipo de cuenta" htmlFor="accountType" error={errors.accountType}>
          <select id="accountType" name="accountType" className={select} defaultValue={saved?.accountType ?? ""} required>
            <option value="" disabled>Elige una opción</option>
            <option value="savings">Ahorros</option>
            <option value="checking">Corriente</option>
          </select>
        </Field>
      )}
      <Field
        label={method === "bank" ? "Número de cuenta" : "Celular de la billetera"}
        htmlFor="accountNumber"
        hint={saved ? "Por seguridad, vuelve a escribir el número completo." : method === "wallet" ? "10 dígitos, empieza por 3." : "Solo dígitos."}
        error={errors.accountNumber}
      >
        <Input id="accountNumber" name="accountNumber" inputMode="numeric" required />
      </Field>
      <Field label="Nombre completo del titular" htmlFor="holderName" error={errors.holderName}>
        <Input id="holderName" name="holderName" maxLength={120} defaultValue={saved?.holderName ?? ""} autoComplete="name" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <Field label="Documento" htmlFor="documentType" error={errors.documentType}>
          <select id="documentType" name="documentType" className={select} defaultValue={saved?.documentType ?? "CC"}>
            {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Número de documento" htmlFor="documentNumber" hint={saved ? "Vuelve a escribirlo completo." : undefined} error={errors.documentNumber}>
          <Input id="documentNumber" name="documentNumber" required />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar cuenta"}</Button>
        {saved && <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>}
        {state.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      </div>
    </form>
  );
}
