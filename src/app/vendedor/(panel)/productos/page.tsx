import Link from "next/link";
import { JobStatus } from "@/components/seller/JobStatus";
import { ProductRow } from "@/components/seller/ProductRow";
import { ProductUploader } from "@/components/seller/ProductUploader";
import { Notice } from "@/components/ui/Notice";
import { requireSeller } from "@/lib/auth/guards";
import { listMyBooks, listMyMoveTargets, listMyUploads } from "@/lib/data/queries";
import { getSellerAccess } from "@/lib/seller/access";
import { groupUploadsByProduct } from "@/lib/seller/group-uploads";
import { listMovablePdfs } from "@/lib/seller/movable-pdfs";
import { pickInitialTarget } from "@/lib/seller/pick-initial-target";

export const metadata = { title: "Productos" };
// Server actions on this page enqueue and run the ingestion worker via after().
export const maxDuration = 300;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string | string[] }>;
}) {
  const { producto } = await searchParams;
  const { seller } = await requireSeller();
  const [books, uploads, access, moveTargets] = await Promise.all([
    listMyBooks(seller.id),
    listMyUploads(seller.id),
    getSellerAccess(seller.id, seller.is_platform),
    listMyMoveTargets(seller.id),
  ]);
  const uploaderProducts = books.filter((b) => b.status !== "archived").map((b) => ({ id: b.id, title: b.title }));
  const initialTarget = pickInitialTarget(producto, uploaderProducts);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  // Each PDF is shown under its product. Legacy uploads without a product still need a place.
  const { groups, orphans } = groupUploadsByProduct(books, uploads);
  const orphansInProgress = orphans.filter((u) => u.job?.status !== "succeeded");

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Productos</h1>
        <p className="mt-2 text-fg-muted">Sube uno o varios PDF a un producto, revisa el recetario que genera la IA, ponle precio y publícalo.</p>
      </header>

      {!access.canSell && (
        <Notice>
          Necesitas una{" "}
          <Link href="/vendedor/suscripcion" className="font-medium underline">suscripción activa</Link> para subir PDF y
          publicar tus recetarios. Puedes completar tu perfil antes de pagar.
        </Notice>
      )}

      <div id="subir" className="scroll-mt-6">
        <ProductUploader
          key={initialTarget ?? "default"}
          products={uploaderProducts}
          initialTarget={initialTarget}
          slotsHeld={uploads.length}
          canUpload={access.canSell}
        />
      </div>

      {orphansInProgress.length > 0 && (
        <section aria-labelledby="in-progress" className="space-y-3">
          <h2 id="in-progress" className="font-display text-xl font-semibold">Sin producto</h2>
          {orphansInProgress.map((upload) => (
            <JobStatus key={upload.id} upload={upload} />
          ))}
        </section>
      )}

      <section aria-labelledby="books" className="space-y-4">
        <h2 id="books" className="font-display text-xl font-semibold">Mis productos</h2>
        {books.length === 0 ? (
          <p className="rounded-card border border-dashed border-border-strong p-8 text-center text-fg-muted">
            Aún no tienes productos. Elige «Nuevo producto» arriba, ponle un nombre (y un precio si quieres) y sube tu primer PDF, o créalo vacío.
          </p>
        ) : (
          groups.map(({ book, uploads: productUploads }) => (
            <ProductRow key={book.id} book={book} uploads={productUploads} sellerSlug={seller.slug} siteUrl={siteUrl} moveTargets={moveTargets} movablePdfs={listMovablePdfs({ targetBookId: book.id, products: moveTargets, uploads })} />
          ))
        )}
      </section>
    </div>
  );
}
