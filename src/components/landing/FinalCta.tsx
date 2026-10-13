import { LANDING } from "@/lib/landing/content";
import { ButtonLink } from "@/components/ui/Button";

export function FinalCta() {
  const { finalCta, ctas } = LANDING;
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:pb-28">
      <div className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-16 text-center text-primary-fg sm:px-12">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <h2 className="relative mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{finalCta.title}</h2>
        <p className="relative mx-auto mt-4 max-w-md text-sm opacity-90 sm:text-base">{finalCta.text}</p>
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href={ctas.sell.href} size="lg" variant="inverse">
            {ctas.sell.label}
          </ButtonLink>
          <ButtonLink href={ctas.login.href} size="lg" variant="inverse-outline">
            {ctas.login.label}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
