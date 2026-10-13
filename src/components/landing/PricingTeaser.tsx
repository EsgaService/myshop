import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { LANDING } from "@/lib/landing/content";
import { ButtonLink } from "@/components/ui/Button";

export function PricingTeaser() {
  const { pricing, ctas } = LANDING;
  return (
    <section id={pricing.id} className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
      <div className="grid items-center gap-10 overflow-hidden rounded-[2rem] bg-ink p-8 text-ink-fg sm:p-12 lg:grid-cols-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-primary">{pricing.eyebrow}</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{pricing.title}</h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-fg/70">{pricing.text}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
          <p className="font-mono text-3xl font-semibold tabular-nums sm:text-4xl">{pricing.priceText}</p>
          <ul className="mt-5 space-y-3 text-sm text-ink-fg/80">
            {LANDING.benefits.slice(0, 3).map((b) => (
              <li key={b.title} className="flex items-start gap-2.5">
                <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-primary" aria-hidden />
                {b.title}
              </li>
            ))}
          </ul>
          <ButtonLink href={ctas.sell.href} size="lg" className="mt-7 w-full">
            {ctas.sell.label}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
