import { BookOpenText, Eye } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { bookPaths, storePath } from "@/lib/books/share-links";
import type { Book, SellerUpload } from "@/lib/data/types";
import type { MovablePdf } from "@/lib/seller/movable-pdfs";
import { buttonClasses } from "@/lib/ui/cn";
import { AddExistingPdfsControl } from "./AddExistingPdfsControl";
import { CopyLinkButton } from "./CopyLinkButton";
import { DeleteProductButton } from "./DeleteProductButton";
import type { MoveTarget } from "./MoveUploadForm";
import { ProductPdfList } from "./ProductPdfList";
import { PricePublishControl } from "./PricePublishControl";

/** One product of the seller: its PDFs, status, price editor, publish toggle and share links (R5, R7, R9). */
export function ProductRow({
  book,
  uploads,
  sellerSlug,
  siteUrl,
  moveTargets = [],
  movablePdfs = [],
}: {
  book: Book;
  uploads: SellerUpload[];
  sellerSlug: string;
  siteUrl: string;
  /** Every product the seller can move PDFs into (this one is filtered out). */
  moveTargets?: MoveTarget[];
  /** Ready PDFs of the seller's other products that can be added to this one. */
  movablePdfs?: MovablePdf[];
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
        <ProductPdfList uploads={uploads} moveTargets={moveTargets.filter((t) => t.id !== book.id)} />
        {canDelete && (
          <p className="text-xs text-fg-muted">
            Este producto no tiene PDF. Puedes subir uno, moverle un PDF desde otro producto o eliminarlo si ya no lo necesitas.
          </p>
        )}
        <AddExistingPdfsControl target={{ id: book.id, title: book.title }} pdfs={movablePdfs} />
        {book.status !== "archived" && (
          <div className="space-y-1">
            <Link href={`/vendedor/productos?producto=${book.id}#subir`} className="text-sm font-medium text-primary hover:underline">
              Subir más PDF
            </Link>
            {published && (
              <p className="text-xs text-fg-muted">
                Las recetas de los PDF nuevos aparecen para tus compradores apenas terminen de procesarse.
              </p>
            )}
          </div>
        )}
      </section>

      <PricePublishControl bookId={book.id} priceCents={book.price_cents} published={published} />

      <div className="grid gap-3 sm:grid-cols-2">
        <a href={paths.landing} target="_blank" rel="noopener" className={buttonClasses({ className: "w-full min-w-0" })}>
          <Eye size={18} weight="bold" aria-hidden />
          <span className="truncate">Previsualizar página de venta</span>
        </a>
        <a href={paths.book} target="_blank" rel="noopener" className={buttonClasses({ variant: "outline", className: "w-full min-w-0" })}>
          <BookOpenText size={18} weight="bold" aria-hidden />
          <span className="truncate">Previsualizar recetario</span>
        </a>
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
