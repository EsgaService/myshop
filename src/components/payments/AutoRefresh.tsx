"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the server page every few seconds while a payment is still pending (capped). */
export function AutoRefresh({ intervalMs = 4000, maxRefreshes = 30 }: { intervalMs?: number; maxRefreshes?: number }) {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      if (count > maxRefreshes) return clearInterval(timer);
      router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs, maxRefreshes]);
  return null;
}
