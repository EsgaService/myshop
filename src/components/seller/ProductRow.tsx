import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { bookPaths, storePath } from "@/lib/books/share-links";
import type { Book, SellerUpload } from "@/lib/data/types";
import { CopyLinkButton } from "./CopyLinkButton";
import { DeleteProductButton } from "./DeleteProductButton";
import { PriceEditor } from "./PriceEditor";
import { ProductPdfList } from "./ProductPdfList";
import { PublishControl } from "./PublishControl";

/** One product of the seller: its PDFs, status, price editor, publish toggle and share links (R5, R7, R9). */
export function ProductRow({
  book,
  uploads,
  sellerSlug,
  siteUrl,
}: {
  book: Book;
  uploads: SellerUpload[];
  sellerSlug: string;
  siteUrl: string;
}) {
  const published = book.status === "published";
  const canDelete = book.status === "draft" && uploads.length === 0;
  const paths = bookPaths(sellerSlug, book.slug);

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl font-semibold">{book.title}</h3>
          {book.tagline && <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{book.tagline}</p>}
        </div>
        <Badge tone={published ? "success" : "neutral"}>{published ? "Publicado" : "Borrador"}</Badge>
      </div>

      <section aria-label={`PDF de ${book.title}`} className="space-y-2">
        <h4 className="text-sm font-medium text-fg">
          PDF del producto <span className="font-mono text-fg-muted">({uploads.length})</span>
        </h4>
        <ProductPdfList uploads={uploads} />
      </section>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <PriceEditor bookId={book.id} priceCents={book.price_cents} />
        <PublishControl bookId={book.id} published={published} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4">
        <CopyLinkButton label="Copiar enlace de la tienda" path={storePath(sellerSlug)} siteUrl={siteUrl} />
        <CopyLinkButton label="Copiar enlace del recetario" path={paths.landing} siteUrl={siteUrl} />
        {canDelete && <DeleteProductButton bookId={book.id} />}
        <Link href={`/vendedor/productos/${book.id}`} className="ml-auto text-sm font-medium text-primary hover:underline">
          Editar detalles
        </Link>
      </div>
      {!published && (
        <p className="text-xs text-fg-muted">Los enlaces solo funcionan para los compradores cuando el recetario está publicado.</p>
      )}
    </Card>
  );
}
