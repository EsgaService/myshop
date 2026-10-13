/**
 * Whether a PDF row shows the "review images" notice (R3.7): its images finished and the seller has not
 * opened the editor for that PDF yet (`images_review_pending` is cleared by the editor, never by a GET).
 */
export function decideReviewNotice(input: {
  uploadStatus: "pending" | "uploaded" | "processing" | "ready" | "failed";
  imagesStatus: "processing" | "done" | "failed" | null;
  reviewPending: boolean;
}): boolean {
  return input.uploadStatus === "ready" && input.imagesStatus === "done" && input.reviewPending;
}
