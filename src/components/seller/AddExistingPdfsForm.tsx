import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { MovablePdf } from "@/lib/seller/movable-pdfs";

/** Presentational: the checkbox list of movable PDFs and the "Añadir" button. State and server calls live in AddExistingPdfsControl. */
export function AddExistingPdfsForm({
  bookId,
  pdfs,
  selected,
  pending,
  onToggle,
  onAdd,
  feedback,
}: {
  bookId: string;
  pdfs: MovablePdf[];
  selected: ReadonlySet<string>;
  pending: boolean;
  onToggle: (uploadId: string) => void;
  onAdd: () => void;
  feedback?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <ul className="space-y-1.5" aria-label="PDF de otros productos">
        {pdfs.map((pdf) => {
          const id = `add-pdf-${bookId}-${pdf.id}`;
          return (
            <li key={pdf.id} className="flex items-center gap-2 text-sm">
              <input
                id={id}
                type="checkbox"
                checked={selected.has(pdf.id)}
                disabled={pending}
                onChange={() => onToggle(pdf.id)}
                className="size-4 shrink-0"
              />
              <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                <span className="font-medium">{pdf.name}</span>{" "}
                <span className="text-fg-muted">en «{pdf.productTitle}»</span>
              </label>
            </li>
          );
        })}
      </ul>
      <Button variant="outline" className="h-9 px-4" disabled={pending || selected.size === 0} onClick={onAdd}>
        {pending ? "Añadiendo…" : selected.size > 1 ? `Añadir ${selected.size} PDF` : "Añadir"}
      </Button>
      {feedback}
    </div>
  );
}
