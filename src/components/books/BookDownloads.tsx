import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { formatFileSize, pdfDownloadPath, type BookPdf } from "@/lib/books/pdf-download";

/** Original PDFs of a purchased book. Links go through the authorized download route, never to storage. */
export function BookDownloads({ bookId, pdfs }: { bookId: string; pdfs: BookPdf[] }) {
  if (pdfs.length === 0) return null;
  return (
    <section aria-labelledby="book-downloads-title" className="mx-auto max-w-6xl px-4 pt-6">
      <div className="rounded-2xl border border-black/10 bg-white/60 p-4">
        <h2 id="book-downloads-title" className="text-sm font-semibold">
          Descargar PDF original
        </h2>
        <ul className="mt-2 divide-y divide-black/5">
          {pdfs.map((pdf) => (
            <li key={pdf.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                {pdf.name} <span className="text-xs opacity-60">({formatFileSize(pdf.sizeBytes)})</span>
              </span>
              <a
                href={pdfDownloadPath(bookId, pdf.id)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-black/5"
              >
                <DownloadSimple size={14} aria-hidden="true" />
                Descargar
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
