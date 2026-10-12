import Link from "next/link";
import { JobStatus } from "@/components/seller/JobStatus";
import { ProductRow } from "@/components/seller/ProductRow";
import { UploadDropzone } from "@/components/seller/UploadDropzone";
import { Notice } from "@/components/ui/Notice";
import { requireSeller } from "@/lib/auth/guards";
import { listMyBooks, listMyUploads } from "@/lib/data/queries";
import { getSellerAccess } from "@/lib/seller/access";

export const metadata = { title: "Productos" };
// Server actions on this page enqueue and run the ingestion worker via after().
export const maxDuration = 300;

export default async function ProductsPage() {
  const { seller } = await requireSeller();
  const [books, uploads, access] = await Promise.all([
    listMyBooks(seller.id),
    listMyUploads(seller.id),
    getSellerAccess(seller.id, seller.is_platform),
  ]);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  // Uploads that already became a book are represented by their ProductRow.
  const inProgress = uploads.filter((u) => !u.book_id && u.job?.status !== "succeeded");

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Productos</h1>
        <p className="mt-2 text-fg-muted">Sube tus PDF, revisa el recetario que genera la IA, ponle precio y publícalo.</p>
      </header>

      {!access.canSell && (
        <Notice>
          Necesitas una{" "}
          <Link href="/vendedor/suscripcion" className="font-medium underline">suscripción activa</Link> para subir PDF y
          publicar tus recetarios. Puedes completar tu perfil antes de pagar.
        </Notice>
      )}

      <UploadDropzone activeCount={uploads.length} canUpload={access.canSell} />

      {inProgress.length > 0 && (
        <section aria-labelledby="in-progress" className="space-y-3">
          <h2 id="in-progress" className="font-display text-xl font-semibold">En proceso</h2>
          {inProgress.map((upload) => (
            <JobStatus key={upload.id} upload={upload} />
          ))}
        </section>
      )}

      <section aria-labelledby="books" className="space-y-4">
        <h2 id="books" className="font-display text-xl font-semibold">Mis recetarios</h2>
        {books.length === 0 ? (
          <p className="rounded-card border border-dashed border-border-strong p-8 text-center text-fg-muted">
            Aún no tienes recetarios. Sube tu primer PDF para crear uno.
          </p>
        ) : (
          books.map((book) => <ProductRow key={book.id} book={book} sellerSlug={seller.slug} siteUrl={siteUrl} />)
        )}
      </section>
    </div>
  );
}
