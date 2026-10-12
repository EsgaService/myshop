import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IngestionJob, IngestionRepo } from "./process-job";

/** Service-role persistence for the ingestion queue. Callers must have authorized the action. */
export function createIngestionRepo(): IngestionRepo {
  const admin = createAdminClient();

  return {
    async getUpload(uploadId) {
      const { data, error } = await admin
        .from("book_uploads")
        .select("id,seller_id,storage_path,original_name,removed_at")
        .eq("id", uploadId)
        .maybeSingle();
      if (error) throw new Error(`Could not read upload: ${error.message}`);
      if (!data || data.removed_at) return null;
      return {
        id: data.id as string,
        sellerId: data.seller_id as string,
        storagePath: data.storage_path as string,
        originalName: data.original_name as string,
      };
    },

    async createBook(sellerId, uploadId, payload) {
      const { data, error } = await admin.rpc("create_book_from_ingestion", {
        p_seller: sellerId,
        p_upload: uploadId,
        p_payload: payload,
      });
      if (error || !data) throw new Error(`Could not create book: ${error?.message ?? "no id returned"}`);
      return data as string;
    },

    async markRetry(jobId, runAfter, error) {
      const { error: e } = await admin
        .from("ingestion_jobs")
        .update({ status: "queued", run_after: runAfter.toISOString(), locked_at: null, last_error: error })
        .eq("id", jobId);
      if (e) throw new Error(`Could not requeue job: ${e.message}`);
    },

    async markFailed(jobId, uploadId, error) {
      const [job, upload] = await Promise.all([
        admin.from("ingestion_jobs").update({ status: "failed", locked_at: null, last_error: error }).eq("id", jobId),
        admin.from("book_uploads").update({ status: "failed", error }).eq("id", uploadId),
      ]);
      if (job.error || upload.error) throw new Error(`Could not mark job failed: ${(job.error ?? upload.error)!.message}`);
    },
  };
}

/** Claims the next runnable job (SKIP LOCKED) or null. */
export async function claimNextJob(): Promise<IngestionJob | null> {
  const { data, error } = await createAdminClient().rpc("claim_ingestion_job");
  if (error) throw new Error(`Could not claim job: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? (row as IngestionJob) : null;
}
