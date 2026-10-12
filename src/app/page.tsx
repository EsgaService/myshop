import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { listStores } from "@/lib/data/queries";
import { formatPrice } from "@/lib/format";

export default async function HomePage() {
  const stores = await listStores();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold">Recetarios para preparar en casa</h1>
        <p className="mt-2 text-neutral-600">Elige un recetario, entra con Google y empieza a cocinar.</p>

        {stores.length === 0 ? (
          <p className="mt-10 text-neutral-500">Aún no hay recetarios disponibles.</p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {stores.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/${s.slug}`}
                  className="block h-full rounded-2xl p-6 shadow transition hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ background: s.background_color, color: s.text_color, borderTop: `6px solid ${s.primary_color}` }}
                >
                  <h2 className="text-xl font-bold" style={{ color: s.primary_color }}>{s.name}</h2>
                  {s.tagline && <p className="mt-1 text-sm opacity-80">{s.tagline}</p>}
                  <p className="mt-4 text-sm font-semibold">{formatPrice(s.price_cents, s.currency)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
