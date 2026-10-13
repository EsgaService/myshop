import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IngestionJob, IngestionRepo } from "./process-job";
import { createIngestionRepoCore } from "./repo-core";

/** Service-role persistence for the ingestion queue. Callers must have authorized the action. */
export function createIngestionRepo(): IngestionRepo {
  return createIngestionRepoCore(createAdminClient());
}

/** Claims the next runnable job (SKIP LOCKED) or null. */
export async function claimNextJob(): Promise<IngestionJob | null> {
  const { data, error } = await createAdminClient().rpc("claim_ingestion_job");
  if (error) throw new Error(`Could not claim job: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? (row as IngestionJob) : null;
}
