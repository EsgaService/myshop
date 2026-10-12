export type DownloadDecision = { ok: true } | { ok: false; reason: "not_found" };

/**
 * Who may download an original PDF (R3.1): the owner seller or a buyer with a purchase, and only for
 * a ready, non-removed upload of the requested book. Every denial is the same "not_found" so the route
 * answers 404 and cannot be used to probe which uploads or books exist.
 */
export function decideDownload(input: {
  isOwner: boolean;
  hasPurchase: boolean;
  upload: { bookMatches: boolean; status: string; removed: boolean } | null;
}): DownloadDecision {
  const { upload } = input;
  if (!upload || !upload.bookMatches || upload.removed || upload.status !== "ready") {
    return { ok: false, reason: "not_found" };
  }
  if (!input.isOwner && !input.hasPurchase) return { ok: false, reason: "not_found" };
  return { ok: true };
}
