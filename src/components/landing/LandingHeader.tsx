import { Suspense } from "react";
import Link from "next/link";
import { LANDING, landingHomeFor } from "@/lib/landing/content";
import { getProfile } from "@/lib/data/queries";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

async function AuthSlot() {
  let role = null;
  try {
    role = (await getProfile())?.role ?? null;
  } catch {
    role = null;
  }
  const cta = landingHomeFor(role);
  return (
    <ButtonLink href={cta.href} variant="outline" className="h-10 px-4">
      {cta.label}
    </ButtonLink>
  );
}

export function LandingHeader() {
  const fallback = landingHomeFor(null);
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />
        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {LANDING.nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-full px-4 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg">
              {item.label}
            </Link>
          ))}
        </nav>
        <Suspense
          fallback={
            <ButtonLink href={fallback.href} variant="outline" className="h-10 px-4">
              {fallback.label}
            </ButtonLink>
          }
        >
          <AuthSlot />
        </Suspense>
      </div>
    </header>
  );
}
