"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { removeUpload, retryIngestion, type SimpleResult } from "@/app/vendedor/(panel)/productos/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { SellerUpload, UploadJob } from "@/lib/data/types";
import { describeUpload } from "@/lib/ingestion/job-view";

const POLL_MS = 3000;

type PolledJob = Pick<UploadJob, "status" | "attempts" | "max_attempts"> & { error: string | null };

/** One PDF being turned into a book. Polls the owner-only status endpoint until the job settles (R12). */
export function JobStatus({ upload }: { upload: SellerUpload }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [needsPlan, setNeedsPlan] = useState(false);
  const [polled, setPolled] = useState<PolledJob | null>(null);

  // Server data wins whenever the page re-renders with a fresh job.
  const job: PolledJob | null = polled ?? (upload.job ? { ...upload.job, error: upload.job.last_error } : null);
  const view = describeUpload({ uploadStatus: upload.status, job });
  const error = job?.status === "failed" ? job.error : upload.status === "failed" ? upload.error : null;

  const jobId = upload.job?.id;
  const settled = job?.status;

  useEffect(() => {
    setPolled(null);
  }, [upload.job?.status, upload.status]);

  useEffect(() => {
    if (!view.polling) return;
    let cancelled = false;

    const tick = async () => {
      try {
        if (!jobId) {
          router.refresh(); // job row not visible yet
          return;
        }
        const res = await fetch(`/api/ingestion/jobs/${jobId}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { status: PolledJob["status"]; attempts: number; maxAttempts: number; error: string | null };
        if (cancelled) return;
        setPolled({ status: body.status, attempts: body.attempts, max_attempts: body.maxAttempts, error: body.error });
        if (body.status === "succeeded" || body.status === "failed") router.refresh();
      } catch {
        // Network blip: the next tick retries.
      }
    };

    const interval = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [view.polling, jobId, router, settled]);

  function run(action: (id: string) => Promise<SimpleResult>) {
    setActionError(null);
    setNeedsPlan(false);
    startTransition(async () => {
      const result = await action(upload.id);
      if (!result.ok) {
        setActionError(result.message);
        setNeedsPlan(result.code === "subscription_required");
      }
      else router.refresh();
    });
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{upload.original_name}</p>
        <p className="mt-0.5 text-xs text-fg-muted">
          {view.polling ? "Esto puede tardar unos minutos. Puedes seguir usando el panel." : ""}
          {error && <span className="text-danger">{error}</span>}
        </p>
        {actionError && (
          <p role="alert" className="mt-1 text-xs text-danger">
            {actionError}
            {needsPlan && (
              <>
                {" "}
                <Link href="/vendedor/suscripcion" className="font-medium underline">
                  Activa tu suscripción
                </Link>
                .
              </>
            )}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={view.tone} aria-live="polite">{view.label}</Badge>
        {view.canRetry && (
          <Button variant="outline" className="h-9 px-4" disabled={pending} onClick={() => run(retryIngestion)}>
            Reintentar
          </Button>
        )}
        {view.canRemove && (
          <Button variant="ghost" className="h-9 px-4" disabled={pending} onClick={() => run(removeUpload)}>
            Eliminar
          </Button>
        )}
      </div>
    </Card>
  );
}
