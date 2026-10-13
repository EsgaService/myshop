import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth/guards";
import { listMyBooks } from "@/lib/data/queries";
import { listActiveUploadIds, listRecipesForPhotos } from "@/lib/data/image-queries";
import { isUuid } from "@/lib/ids";
import { MarkReviewed } from "./MarkReviewed";
import { ReextractButton } from "./ReextractButton";
import { RecipePhotoRow } from "./RecipePhotoRow";

export const metadata = { title: "Fotos de las recetas" };

export default async function RecipePhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<{ upload?: string }>;
}) {
  const { bookId } = await params;
  const { upload } = await searchParams;
  const { seller } = await requireSeller();
  if (!isUuid(bookId)) notFound();

  // listMyBooks runs under RLS for this seller: another seller's product is simply not found.
  const book = (await listMyBooks(seller.id)).find((b) => b.id === bookId);
  if (!book) notFound();

  // `?upload=` filters to one PDF and must name a ready, active PDF of this product.
  let uploadId: string | undefined;
  if (upload !== undefined) {
    if (!isUuid(upload)) notFound();
    const owned = await listActiveUploadIds(seller.id, book.id, upload);
    if (owned.length === 0) notFound();
    uploadId = upload;
  }

  const recipes = await listRecipesForPhotos(book.id, uploadId);

  return (
    <div className="space-y-6">
      {uploadId && <MarkReviewed uploadId={uploadId} />}
      <div>
        <Link href={`/vendedor/productos/${book.id}`} className="text-sm font-medium text-primary hover:underline">← Volver al producto</Link>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Fotos de las recetas</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {book.title}
          {uploadId ? " · solo las recetas de este PDF." : "."} Elige la foto de cada receta entre las imágenes de tu PDF, sube la tuya o quítala.
        </p>
        {uploadId && (
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <ReextractButton uploadId={uploadId} />
            <Link href={`/vendedor/productos/${book.id}/recetas`} className="pt-2 text-sm font-medium text-primary hover:underline">
              Ver las recetas de todos los PDF
            </Link>
          </div>
        )}
      </div>

      {recipes.length === 0 ? (
        <p className="text-sm text-fg-muted">No hay recetas para mostrar todavía.</p>
      ) : (
        <ul className="space-y-3" aria-label="Recetas">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <RecipePhotoRow recipeId={recipe.id} title={recipe.title} photoPath={recipe.photoPath} photoSource={recipe.photoSource} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
