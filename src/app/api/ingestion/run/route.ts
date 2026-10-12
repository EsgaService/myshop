import { NextResponse } from "next/server";
import { runIngestionWorker } from "@/lib/ingestion/worker";
import { isAuthorizedWorkerRequest } from "@/lib/ingestion/worker-auth";

export const maxDuration = 300;

/** Drains the ingestion queue. For a cron/scheduler: requires `Authorization: Bearer $INGESTION_WORKER_SECRET`. */
export async function POST(request: Request) {
  if (!isAuthorizedWorkerRequest(request.headers.get("authorization"), process.env.INGESTION_WORKER_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runIngestionWorker();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("ingestion run failed", error);
    return NextResponse.json({ error: "Worker failed" }, { status: 500 });
  }
}
