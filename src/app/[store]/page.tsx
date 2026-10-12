import { notFound, redirect } from "next/navigation";
import { LoginButton } from "@/components/LoginButton";
import { decideAccess } from "@/lib/access/decide-access";
import { getCurrentUser, getStore, hasPurchased } from "@/lib/data/queries";
import { formatPrice } from "@/lib/format";

export default async function StoreLandingPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();

  const user = await getCurrentUser();
  const decision = decideAccess({
    slug,
    route: "landing",
    isAuthenticated: !!user,
    hasPurchase: user ? await hasPurchased(store.id) : false,
  });
  if (decision.kind === "redirect") redirect(decision.to);

  const sample = store.teaser.sample;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section
        className="overflow-hidden rounded-3xl p-8 text-center text-white shadow-lg"
        style={{
          background: store.cover_url ? `linear-gradient(#0007,#0007), url(${store.cover_url}) center/cover` : "var(--brand-primary)",
        }}
      >
        {store.logo_url && <img src={store.logo_url} alt="" className="mx-auto mb-4 h-16 w-auto" />}
        <h1 className="text-3xl font-bold sm:text-4xl">{store.name}</h1>
        {store.tagline && <p className="mt-2 text-lg opacity-90">{store.tagline}</p>}
      </section>

      <section className="mt-8 space-y-3 text-lg leading-relaxed">
        {store.description && <p>{store.description}</p>}
        {(store.teaser.intro ?? []).map((p, i) => (
          <p key={i} className="text-base opacity-80">{p}</p>
        ))}
      </section>

      {sample && (
        <section className="mt-8 rounded-2xl border border-black/10 bg-white/60 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--brand-primary)" }}>Receta de muestra</p>
          <h2 className="mt-1 text-2xl font-bold">{sample.title}</h2>
          <h3 className="mt-4 font-semibold">Ingredientes</h3>
          <ul className="mt-1 list-disc pl-5">
            {sample.ingredients.map((i, k) => <li key={k}>{i}</li>)}
          </ul>
          <p className="mt-4 text-sm opacity-70">Compra el recetario para ver los pasos y todas las demás recetas.</p>
        </section>
      )}

      <section className="mt-10 rounded-2xl p-6 text-center" style={{ background: "var(--brand-secondary)", color: "#111" }}>
        <p className="text-sm font-semibold uppercase tracking-wide">Acceso completo</p>
        <p className="mt-1 text-4xl font-extrabold">{formatPrice(store.price_cents, store.currency)}</p>
        <div className="mt-4 flex justify-center">
          <LoginButton next={`/${store.slug}`} label="Entrar con Google" />
        </div>
        <p className="mt-3 text-sm">Inicia sesión con tu cuenta de Google para continuar con la compra.</p>
      </section>
    </main>
  );
}
