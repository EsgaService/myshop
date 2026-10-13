import { CookingPot, Clock, Users } from "@phosphor-icons/react/dist/ssr";

/** Decorative CSS mock of the interactive recipe book and a seller dashboard card. */
export function BookMock() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary-soft via-warning-soft to-transparent blur-2xl" />

      {/* Recipe book */}
      <div className="float-slow overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-lift [--r:-2deg]">
        <div className="flex items-center gap-1.5 border-b border-border bg-surface-muted px-4 py-3">
          <span className="size-2.5 rounded-full bg-danger/60" />
          <span className="size-2.5 rounded-full bg-warning/60" />
          <span className="size-2.5 rounded-full bg-success/60" />
          <span className="ml-3 h-5 flex-1 rounded-full bg-border/70" />
        </div>
        <div className="p-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-primary">Cócteles clásicos</p>
          <h3 className="mt-1 font-display text-2xl font-semibold leading-tight">Margarita de la casa</h3>
          <div className="mt-3 flex gap-4 text-xs text-fg-muted">
            <span className="inline-flex items-center gap-1"><Clock size={14} /> 5 min</span>
            <span className="inline-flex items-center gap-1"><Users size={14} /> 2 porciones</span>
          </div>
          <div className="mt-4 flex gap-2">
            {["Todas", "Cócteles", "Micheladas"].map((c, i) => (
              <span key={c} className={`rounded-full px-3 py-1 text-xs font-medium ${i === 1 ? "bg-primary text-primary-fg" : "bg-surface-muted text-fg-muted"}`}>
                {c}
              </span>
            ))}
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              ["Tequila blanco", "60 ml"],
              ["Jugo de limón", "30 ml"],
              ["Triple sec", "20 ml"],
            ].map(([name, qty]) => (
              <li key={name} className="flex items-center justify-between border-b border-dashed border-border pb-2">
                <span>{name}</span>
                <span className="font-mono text-xs tabular-nums text-fg-muted">{qty}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-primary-fg">
            <CookingPot size={18} weight="bold" /> Modo cocina
          </div>
        </div>
      </div>

      {/* Floating sales card */}
      <div className="float-slow absolute -bottom-6 -left-4 w-48 rounded-2xl border border-border bg-surface p-4 shadow-lift [--r:3deg] sm:-left-10" style={{ animationDelay: "1.2s" }}>
        <p className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">Ventas este mes</p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">$ 1.240.000</p>
        <svg viewBox="0 0 120 32" className="mt-2 h-8 w-full" fill="none">
          <path d="M2 26 L22 20 L42 23 L62 12 L82 15 L102 5 L118 8" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Published chip */}
      <div className="float-slow absolute -right-2 top-10 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium shadow-lift [--r:2deg] sm:-right-8" style={{ animationDelay: "0.6s" }}>
        <span className="mr-1.5 inline-block size-2 rounded-full bg-success" /> Publicado
      </div>
    </div>
  );
}
