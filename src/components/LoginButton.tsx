"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginButton({ next = "/", label = "Entrar con Google", className = "" }: { next?: string; label?: string; className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
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
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
