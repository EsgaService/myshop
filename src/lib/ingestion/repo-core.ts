import type { SupabaseClient } from "@supabase/supabase-js";
import type { IngestionRepo } from "./process-job";

export type AdminLike = Pick<SupabaseClient, "from" | "rpc">;

/**
 * Persistence for the ingestion queue (no I/O of its own: the client is injected).
 *
 * Outcome writes (retry / failure) are guarded by `status = processing AND attempts = <claimed attempt>`:
 * a worker that outlived its claim (the job was reclaimed as stale) must not clobber the newer attempt.
 * Success needs no guard here: `create_book_from_ingestion` is idempotent per upload.
 */
export function createIngestionRepoCore(admin: AdminLike): IngestionRepo {
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

    async markRetry(job, runAfter, error) {
      const { error: e } = await admin
        .from("ingestion_jobs")
        .update({ status: "queued", run_after: runAfter.toISOString(), locked_at: null, last_error: error })
        .eq("id", job.id)
        .eq("status", "processing")
        .eq("attempts", job.attempts)
        .select("id");
      if (e) throw new Error(`Could not requeue job: ${e.message}`);
    },

    async markFailed(job, error) {
      const { data, error: e } = await admin
        .from("ingestion_jobs")
        .update({ status: "failed", locked_at: null, last_error: error })
        .eq("id", job.id)
        .eq("status", "processing")
        .eq("attempts", job.attempts)
        .select("id");
      if (e) throw new Error(`Could not mark job failed: ${e.message}`);
      // Reclaimed by another worker: the newer attempt owns the upload status now.
      if (!data || data.length === 0) return;

      const { error: uploadError } = await admin
        .from("book_uploads")
        .update({ status: "failed", error })
        .eq("id", job.upload_id);
      if (uploadError) throw new Error(`Could not mark upload failed: ${uploadError.message}`);
    },
  };
}
