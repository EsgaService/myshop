import { BookOpenText, LinkSimple, Books, CreditCard, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { LANDING } from "@/lib/landing/content";

const ICONS = [BookOpenText, LinkSimple, Books, CreditCard, Sparkle];

export function Benefits() {
  return (
    <section className="border-y border-border bg-surface-muted/60">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <p className="font-mono text-[11px] uppercase tracking-wider text-primary">02 / Beneficios</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{LANDING.benefitsTitle}</h2>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING.benefits.map((b, i) => {
            const Icon = ICONS[i] ?? Sparkle;
            return (
              <li key={b.title} className="rounded-card border border-border bg-surface p-6 shadow-soft">
                <Icon size={26} weight="duotone" className="text-primary" aria-hidden />
                <h3 className="mt-4 font-display text-lg font-semibold">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{b.text}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
