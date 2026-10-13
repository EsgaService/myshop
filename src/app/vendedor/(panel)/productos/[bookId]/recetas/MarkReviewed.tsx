"use client";

import { useEffect } from "react";
import { markImagesReviewed } from "@/app/vendedor/(panel)/productos/image-actions";

/**
 * Clears the PDF's "review images" notice once the editor is actually open in a browser. It is an effect (not
 * server rendering) so a prefetch of the page can never clear the notice.
 */
export function MarkReviewed({ uploadId }: { uploadId: string }) {
  useEffect(() => {
    void markImagesReviewed(uploadId);
  }, [uploadId]);
  return null;
}
