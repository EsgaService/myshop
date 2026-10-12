"use client";

import { useState } from "react";
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

  async function login() {
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
      <button
        type="button"
        onClick={login}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-fg shadow-soft transition hover:bg-primary-hover disabled:opacity-60 ${className}`}
      >
        {loading ? "Redirigiendo…" : label}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
