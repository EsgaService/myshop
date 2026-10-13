import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

export type MoveTarget = { id: string; title: string };

/** Presentational: the target select and the "Mover" button. State and the server call live in MoveUploadControl. */
export function MoveUploadForm({
  uploadId,
  targets,
  value,
  pending,
  onChange,
  onMove,
  feedback,
}: {
  uploadId: string;
  targets: MoveTarget[];
  value: string;
  pending: boolean;
  onChange: (targetId: string) => void;
  onMove: () => void;
  feedback?: ReactNode;
}) {
  const selectId = `move-target-${uploadId}`;
  return (
    <div className="w-full space-y-1.5 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={selectId} className="text-xs font-medium text-fg-muted">
          Mover a…
        </label>
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={pending}
          className="h-9 min-w-0 max-w-full flex-1 rounded-xl border border-border-strong bg-surface px-3 text-sm text-fg focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
        >
          <option value="">Elige un producto</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <Button variant="outline" className="h-9 px-4" disabled={pending || value === ""} onClick={onMove}>
          {pending ? "Moviendo…" : "Mover"}
        </Button>
      </div>
      {feedback}
    </div>
  );
}
