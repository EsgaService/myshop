import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { CONSENT } from "@/lib/auth/consent";
import { LANDING } from "@/lib/landing/content";
import { ButtonLink } from "@/components/ui/Button";
import { BookMock } from "./BookMock";

export function Hero() {
  const { hero, ctas } = LANDING;
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem] bg-[radial-gradient(60rem_30rem_at_80%_-10%,var(--primary-soft),transparent)]" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pb-28 lg:pt-24">
        <div>
          <p className="reveal inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-fg-muted" style={{ "--i": 0 } as React.CSSProperties}>
            <span className="size-1.5 rounded-full bg-primary" /> {hero.eyebrow}
          </p>
          <h1 className="reveal mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl" style={{ "--i": 1 } as React.CSSProperties}>
            {hero.title}
          </h1>
          <p className="reveal mt-5 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg" style={{ "--i": 2 } as React.CSSProperties}>
            {hero.text}
          </p>
          <div className="reveal mt-8 flex flex-col gap-3 sm:flex-row" style={{ "--i": 3 } as React.CSSProperties}>
            <ButtonLink href={ctas.sell.href} size="lg">
              {ctas.sell.label} <ArrowRight size={18} weight="bold" aria-hidden />
            </ButtonLink>
            <ButtonLink href={ctas.signup.href} variant="outline" size="lg">
              {ctas.signup.label}
            </ButtonLink>
            <ButtonLink href={ctas.login.href} variant="outline" size="lg">
              {ctas.login.label}
            </ButtonLink>
          </div>
          <p className="reveal mt-4 text-xs text-fg-muted" style={{ "--i": 3 } as React.CSSProperties}>
            Al continuar aceptas los{" "}
            <Link href={CONSENT.terms.href} className="underline underline-offset-4 hover:text-fg">{CONSENT.terms.label}</Link>{" "}
            y la{" "}
            <Link href={CONSENT.privacy.href} className="underline underline-offset-4 hover:text-fg">{CONSENT.privacy.label}</Link>.
          </p>
        </div>
        <div className="reveal px-2 pb-8 sm:px-8 lg:px-0" style={{ "--i": 4 } as React.CSSProperties}>
          <BookMock />
        </div>
      </div>
    </section>
  );
}
