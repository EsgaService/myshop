"use client";

import { useEffect, useState } from "react";
import { listRecipeCandidates, type RecipeCandidate } from "@/app/vendedor/(panel)/productos/image-actions";
import { Button } from "@/components/ui/Button";
import { ImageGrid } from "../ImageGrid";

/**
 * Candidate images for one recipe, loaded on demand (24 at a time, nearest pages first) so a long PDF never
 * ships hundreds of thumbnails up front. Presentational apart from the fetch; the parent decides what a pick does.
 */
export function ImagePicker({
  recipeId,
  selectedId,
  disabled,
  onPick,
}: {
  recipeId: string;
  selectedId: string | null;
  disabled: boolean;
  onPick: (imageId: string) => void;
}) {
  const [items, setItems] = useState<RecipeCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(offset: number) {
    setLoading(true);
    const result = await listRecipeCandidates(recipeId, offset);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setTotal(result.total);
    setItems((prev) => (offset === 0 ? result.items : [...prev, ...result.items]));
  }

  useEffect(() => {
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  if (error) return <p role="alert" className="text-sm text-danger">{error}</p>;
  if (loading && items.length === 0) return <p className="text-sm text-fg-muted">Cargando imágenes…</p>;

  return (
    <div className="space-y-3">
      <ImageGrid
        images={items.map((i) => ({ id: i.id, thumbUrl: i.thumbUrl, label: i.label }))}
        selectedId={selectedId}
        onSelect={onPick}
        paginate={false}
        disabled={disabled}
        emptyText="No encontramos imágenes en este PDF. Puedes subir la tuya."
      />
      {items.length < total && (
        <Button variant="outline" className="h-9 px-4" disabled={loading} onClick={() => void load(items.length)}>
          {loading ? "Cargando…" : `Mostrar más (${total - items.length})`}
        </Button>
      )}
    </div>
  );
}
