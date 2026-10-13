"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/ui/cn";

export type GridImage = { id: string; thumbUrl: string; label: string };

/** Presentational grid of selectable thumbnails with a "show more" step, so long PDFs stay light. */
export function ImageGrid({
  images,
  selectedId,
  onSelect,
  pageSize = 24,
  emptyText,
  disabled = false,
}: {
  images: GridImage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  pageSize?: number;
  emptyText: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(pageSize);
  if (images.length === 0) return <p className="text-sm text-fg-muted">{emptyText}</p>;

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {images.slice(0, visible).map((image) => {
          const selected = image.id === selectedId;
          return (
            <li key={image.id}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                aria-label={image.label}
                onClick={() => onSelect(image.id)}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-xl border bg-surface-muted transition",
                  selected ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-border-strong",
                  disabled && "opacity-60",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.thumbUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">
                  {image.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {visible < images.length && (
        <Button variant="outline" className="h-9 px-4" onClick={() => setVisible((v) => v + pageSize)}>
          Mostrar más ({images.length - visible})
        </Button>
      )}
    </div>
  );
}
