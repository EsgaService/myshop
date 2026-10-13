"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { absoluteUrl } from "@/lib/books/share-links";

type Feedback = "idle" | "copied" | "error";

/** Copies an absolute share URL. `siteUrl` may be empty: the browser origin is used then. */
export function CopyLinkButton({ label, path, siteUrl }: { label: string; path: string; siteUrl: string }) {
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    const url = absoluteUrl(path, siteUrl || window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("copied");
    } catch {
      setFeedback("error");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback("idle"), 2500);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="outline" onClick={copy} className="h-9 px-4">
        {label}
      </Button>
      <span role="status" aria-live="polite" className="text-xs text-fg-muted">
        {feedback === "copied" && "Enlace copiado"}
        {feedback === "error" && "No pudimos copiar. Cópialo manualmente."}
      </span>
    </span>
  );
}
