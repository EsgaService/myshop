"use client";

import { useState } from "react";

/** Mock checkout form: any value is accepted. Real gateways redirect to a hosted page instead. */
export function PayForm({ slug }: { slug: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch(`/api/pay/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No pudimos procesar el pago.");
      window.location.assign(data.redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos procesar el pago.");
      setBusy(false);
    }
  }

  const field = "mt-1 w-full rounded-lg border border-black/20 bg-white px-3 py-2 text-neutral-900";

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">Modo de prueba: no se realiza ningún cobro real.</p>
      <label className="block text-sm font-medium">Nombre en la tarjeta
        <input name="name" className={field} autoComplete="cc-name" />
      </label>
      <label className="block text-sm font-medium">Número de tarjeta
        <input name="card" className={field} inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm font-medium">Vence
          <input name="expiry" className={field} autoComplete="cc-exp" placeholder="MM/AA" />
        </label>
        <label className="block text-sm font-medium">CVC
          <input name="cvc" className={field} inputMode="numeric" autoComplete="cc-csc" />
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-brand px-6 py-3 font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Procesando…" : "Pagar y entrar al recetario"}
      </button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
