"use client";

import { useState } from "react";

/** Hosted checkout: the server stores the checkout and answers with the Wompi URL to go to. */
export function WompiPayButton({ bookId }: { bookId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pay/book/${bookId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No pudimos iniciar el pago.");
      window.location.assign(data.redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos iniciar el pago.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm opacity-70">Pagas de forma segura en Wompi con tarjeta, PSE, Nequi u otros medios. Te traeremos de vuelta aquí al terminar.</p>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="w-full rounded-full bg-book-primary px-6 py-3 font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Redirigiendo a Wompi…" : "Pagar con Wompi"}
      </button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
