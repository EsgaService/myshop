import { notFound, redirect } from "next/navigation";
import { decideAccess } from "@/lib/access/decide-access";
import { getBook, getCurrentUser, getStore, hasPurchased } from "@/lib/data/queries";
import { RecipeBook } from "./RecipeBook";

export default async function BookPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();

  const user = await getCurrentUser();
  const decision = decideAccess({
    paths: { landing: `/${slug}`, checkout: `/${slug}/pagar`, book: `/${slug}/recetario` },
    route: "book",
    viewer: user ? "buyer" : "anon",
    hasPurchase: user ? await hasPurchased(store.id) : false,
    isOwner: false,
    sellable: true,
  });
  if (decision.kind === "redirect") redirect(decision.to);

  // These queries run under the user's RLS: without a purchase they would return nothing anyway.
  const { categories, sections, recipes } = await getBook(store.id);

  return <RecipeBook storeSlug={store.slug} storeName={store.name} categories={categories} sections={sections} recipes={recipes} />;
}
