"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { CONSENT, canStartLogin } from "@/lib/auth/consent";
import { createClient } from "@/lib/supabase/client";

type Intent = "buyer" | "seller";

/**
 * Google sign-in. `as` records which auth screen was used; the server applies it
 * only when the account does not exist yet and never changes an existing role.
 */
export function LoginButton({
  next = "/",
  as,
  label = "Continuar con Google",
  className = "",
}: {
  next?: string;
  as?: Intent;
  label?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const checkboxId = useId();

  async function login() {
    if (!canStartLogin(accepted)) {
      setConsentError(true);
      return;
    }
    setConsentError(false);
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const params = new URLSearchParams({ next });
    if (as) params.set("as", as);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?${params.toString()}` },
    });
    if (error) {
      setError("No pudimos iniciar sesión. Inténtalo de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-start gap-2 text-left text-sm text-fg-muted">
        <input
          id={checkboxId}
          type="checkbox"
          checked={accepted}
          onChange={(e) => {
            setAccepted(e.target.checked);
            if (e.target.checked) setConsentError(false);
          }}
          aria-describedby={consentError ? `${checkboxId}-error` : undefined}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <label htmlFor={checkboxId} className="cursor-pointer">
          He leído y acepto los{" "}
          <Link href={CONSENT.terms.href} target="_blank" rel="noopener noreferrer" className="font-medium text-fg underline underline-offset-4 hover:text-primary">
            {CONSENT.terms.label}
          </Link>{" "}
          y la{" "}
          <Link href={CONSENT.privacy.href} target="_blank" rel="noopener noreferrer" className="font-medium text-fg underline underline-offset-4 hover:text-primary">
            {CONSENT.privacy.label}
          </Link>
        </label>
      </div>
      <button
        type="button"
        onClick={login}
        disabled={loading || !accepted}
        aria-disabled={loading || !accepted}
        className={`inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-fg shadow-soft transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        {loading ? "Redirigiendo…" : label}
      </button>
      {consentError && <p id={`${checkboxId}-error`} role="alert" className="mt-2 text-sm text-danger">{CONSENT.error}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
