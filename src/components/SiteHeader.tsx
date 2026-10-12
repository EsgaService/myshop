import Link from "next/link";
import { getCurrentUser, listPurchasedStoreIds, listStores } from "@/lib/data/queries";
import { LoginButton } from "./LoginButton";

export async function SiteHeader({ currentSlug }: { currentSlug?: string }) {
  const user = await getCurrentUser();
  const [stores, purchased] = user ? await Promise.all([listStores(), listPurchasedStoreIds()]) : [[], new Set<string>()];

  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-white/90 text-neutral-900 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-bold">Recetarios</Link>

        {user ? (
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full border border-black/15 px-4 py-2 text-sm font-medium">
              Mis recetarios
            </summary>
            <nav className="absolute right-0 mt-2 w-72 max-w-[85vw] rounded-xl border border-black/10 bg-white p-2 shadow-lg">
              <ul>
                {stores.map((s) => {
                  const owned = purchased.has(s.id);
                  return (
                    <li key={s.id}>
                      <Link
                        href={owned ? `/${s.slug}/recetario` : `/${s.slug}/pagar`}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-neutral-100 ${s.slug === currentSlug ? "bg-neutral-100 font-semibold" : ""}`}
                      >
                        <span>{owned ? "" : "🔒 "}{s.name}</span>
                        {!owned && <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs text-white">Comprar</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <form action="/auth/signout" method="post" className="mt-2 border-t border-black/10 pt-2">
                <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-100">
                  Cerrar sesión ({user.email})
                </button>
              </form>
            </nav>
          </details>
        ) : (
          <LoginButton next={currentSlug ? `/${currentSlug}` : "/"} label="Entrar con Google" className="!px-4 !py-2 text-sm" />
        )}
      </div>
    </header>
  );
}
