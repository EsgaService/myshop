import type { SellerUpload } from "@/lib/data/types";
import { JobStatus } from "./JobStatus";

/** The PDFs of one product in upload order (the order their recipes appear in), each with its own status. */
export function ProductPdfList({ uploads }: { uploads: SellerUpload[] }) {
  if (uploads.length === 0) {
    return <p className="text-sm text-fg-muted">Este producto aún no tiene PDF. Sube el primero arriba.</p>;
  }
  return (
    <ul className="space-y-2" aria-label="PDF del producto">
      {uploads.map((upload) => (
        <li key={upload.id}>
          <JobStatus upload={upload} />
        </li>
      ))}
    </ul>
  );
}
