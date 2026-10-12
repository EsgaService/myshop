import { NextResponse } from "next/server";
import { after } from "next/server";
import { getCurrentUser, getMySeller, getProfile } from "@/lib/data/queries";
import { isUuid } from "@/lib/ids";
import { shouldKickWorker } from "@/lib/ingestion/job-view";
import { runIngestionWorker } from "@/lib/ingestion/worker";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

const NOT_FOUND = () => NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Job status for polling (R12). Only the owning seller can read it: anything
 * else answers 404 so job ids cannot be probed. Also kicks the worker when a
 * job has been waiting too long (the after() worker may have died with a restart).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NOT_FOUND();

  const user = await getCurrentUser();
  const profile = user ? await getProfile() : null;
  if (!user || profile?.role !== "seller") return NOT_FOUND();
  const seller = await getMySeller();
  if (!seller) return NOT_FOUND();

  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("ingestion_jobs")
    .select("id,upload_id,status,attempts,max_attempts,run_after,locked_at,last_error")
    .eq("id", id)
    .maybeSingle();
  if (error || !job) return NOT_FOUND();

  const { data: upload } = await admin
    .from("book_uploads")
    .select("seller_id,status,book_id")
    .eq("id", job.upload_id as string)
    .maybeSingle();
  if (!upload || upload.seller_id !== seller.id) return NOT_FOUND();

  if (
    shouldKickWorker({
      status: job.status as "queued" | "processing" | "succeeded" | "failed",
      runAfter: job.run_after as string,
      lockedAt: (job.locked_at as string | null) ?? null,
      now: new Date(),
    })
  ) {
    after(async () => {
      try {
        await runIngestionWorker();
      } catch (e) {
        console.error("ingestion worker failed", e);
      }
    });
  }

  return NextResponse.json(
    {
      id: job.id,
      status: job.status,
      uploadStatus: upload.status,
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      error: job.status === "failed" ? job.last_error : null,
      bookId: upload.book_id,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
