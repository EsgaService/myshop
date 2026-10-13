import { BuyerShell } from "@/components/buyer/BuyerShell";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { BookCard } from "@/components/ui/BookCard";
import { toBookCard } from "@/lib/books/to-card";
import { getCurrentUser, getProfile, listListedBooks } from "@/lib/data/queries";

export const metadata = { title: "Explorar recetarios" };

async function Catalog() {
  const books = await listListedBooks();
  if (books.length === 0) {
    return (
      <p className="mt-8 rounded-card border border-dashed border-border-strong p-10 text-center text-fg-muted">
        Todavía no hay recetarios publicados. Vuelve pronto.
      </p>
    );
  }
  return (
    <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {books.map((book) => (
        <li key={book.id}>
          <BookCard book={toBookCard(book)} />
        </li>
      ))}
    </ul>
  );
}

const heading = (
  <>
    <h1 className="font-display text-3xl font-semibold tracking-tight">Explorar recetarios</h1>
    <p className="mt-1 text-fg-muted">Recetarios interactivos publicados por vendedores.</p>
  </>
);

export default async function ExplorePage() {
  const user = await getCurrentUser();
  const profile = user ? await getProfile() : null;

  // Buyers keep their sidebar; everyone else browses with the public header.
  if (user && profile?.role === "buyer") {
    return (
      <BuyerShell profile={profile} email={user.email}>
        {heading}
        <Catalog />
      </BuyerShell>
    );
  }
  return (
    <>
      <LandingHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {heading}
        <Catalog />
      </main>
    </>
  );
}
