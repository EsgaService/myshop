import { BookCard } from "@/components/ui/BookCard";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { requireBuyer } from "@/lib/auth/guards";
import { avisoMessage } from "@/lib/auth/screens";
import { bookPaths } from "@/lib/books/share-links";
import { toBookCard } from "@/lib/books/to-card";
import { listOwnedBooks } from "@/lib/data/queries";

export const metadata = { title: "Mis recetarios" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const [{ profile }, { aviso }, owned] = await Promise.all([requireBuyer(), searchParams, listOwnedBooks()]);
  const notice = avisoMessage(aviso, profile.role);

  return (
    <div>
      {notice && <Notice>{notice}</Notice>}
      <h1 className="font-display text-3xl font-semibold tracking-tight">Mis recetarios</h1>
      {owned.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-border-strong p-10 text-center">
          <p className="text-fg-muted">Aún no tienes recetarios. Explora el catálogo y consigue el primero.</p>
          <ButtonLink href="/explorar" className="mt-5">Obtener más recetas</ButtonLink>
        </div>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {owned.map((book) => (
            <li key={book.id}>
              {/* Owned books open the reader directly. */}
              <BookCard book={{ ...toBookCard(book), href: bookPaths(book.seller.slug, book.slug).book }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
