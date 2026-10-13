import { FilePdf, Sparkle, ShareNetwork } from "@phosphor-icons/react/dist/ssr";
import { LANDING } from "@/lib/landing/content";

const ICONS = [FilePdf, Sparkle, ShareNetwork];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <p className="font-mono text-[11px] uppercase tracking-wider text-primary">01 / Proceso</p>
      <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{LANDING.stepsTitle}</h2>
      <ol className="mt-12 grid gap-5 md:grid-cols-3">
        {LANDING.steps.map((step, i) => {
          const Icon = ICONS[i] ?? Sparkle;
          return (
            <li key={step.title} className="relative rounded-card border border-border bg-surface p-7 shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-lift">
              <span className="font-mono text-5xl font-semibold tabular-nums text-border-strong">{String(i + 1).padStart(2, "0")}</span>
              <span className="mt-6 grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary">
                <Icon size={22} weight="duotone" aria-hidden />
              </span>
              <h3 className="mt-5 font-display text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{step.text}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
