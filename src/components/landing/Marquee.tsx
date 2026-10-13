import { LANDING } from "@/lib/landing/content";

export function Marquee() {
  const items = LANDING.marquee;
  return (
    <section aria-label="Categorías de ejemplo" className="marquee overflow-hidden border-y border-border bg-ink py-5 text-ink-fg">
      <div className="marquee-track">
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
            {items.map((item) => (
              <li key={item} className="flex items-center font-display text-2xl italic sm:text-3xl">
                <span className="px-6">{item}</span>
                <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}
