import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/components/seller/CopyLinkButton";
import { PricePublishControl } from "@/components/seller/PricePublishControl";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireSeller } from "@/lib/auth/guards";
import { bookPaths, storePath } from "@/lib/books/share-links";
import { listMyBooks } from "@/lib/data/queries";
import { isUuid } from "@/lib/ids";
import { BookDetailsForm } from "./BookDetailsForm";

export const metadata = { title: "Editar recetario" };

export default async function EditBookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const { seller } = await requireSeller();
  if (!isUuid(bookId)) notFound();

  // listMyBooks runs under RLS and filters by this seller: another seller's book id simply is not found (R10).
  const book = (await listMyBooks(seller.id)).find((b) => b.id === bookId);
  if (!book) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const published = book.status === "published";
  const paths = bookPaths(seller.slug, book.slug);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/vendedor/productos" className="text-sm font-medium text-primary hover:underline">← Volver a productos</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{book.title}</h1>
          <Badge tone={published ? "success" : "neutral"}>{published ? "Publicado" : "Borrador"}</Badge>
        </div>
      </div>

      <Card className="space-y-5 p-6">
        <h2 className="font-display text-xl font-semibold">Precio y publicación</h2>
        <PricePublishControl bookId={book.id} priceCents={book.price_cents} published={published} />
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-display text-xl font-semibold">Compartir</h2>
        <p className="text-sm text-fg-muted">
          Tu enlace: <span className="font-mono">{paths.landing}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <CopyLinkButton label="Copiar enlace de la tienda" path={storePath(seller.slug)} siteUrl={siteUrl} />
          <CopyLinkButton label="Copiar enlace del recetario" path={paths.landing} siteUrl={siteUrl} />
        </div>
        {/* Owners can open the product page and the reader, even as a draft, to review the generated book. */}
        <div className="flex flex-wrap gap-4 text-sm font-medium text-primary">
          <Link href={paths.landing} target="_blank" className="hover:underline">Ver página del producto</Link>
          <Link href={paths.book} target="_blank" className="hover:underline">Revisar el recetario generado</Link>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-5 font-display text-xl font-semibold">Detalles</h2>
        <BookDetailsForm
          bookId={book.id}
          initial={{ title: book.title, tagline: book.tagline ?? "", description: book.description ?? "" }}
        />
      </Card>
    </div>
  );
}
