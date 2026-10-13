import { Logo } from "@/components/ui/Logo";
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, type LegalDocument } from "@/lib/legal/content";

export function LegalPage({ doc }: { doc: LegalDocument }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Logo className="mb-10" />
      <h1 className="font-display text-3xl font-semibold tracking-tight">{doc.title}</h1>
      <p className="mt-2 text-sm text-fg-muted">Última actualización: {LEGAL_LAST_UPDATED}</p>
      {doc.sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="font-display text-xl font-semibold">{s.heading}</h2>
          <div className="mt-3 space-y-3 leading-relaxed text-fg-muted">
            {s.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </section>
      ))}
      <footer className="mt-12 border-t border-border pt-6 text-sm text-fg-muted">
        Contacto:{" "}
        <a className="underline underline-offset-2" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
          {LEGAL_CONTACT_EMAIL}
        </a>
      </footer>
    </main>
  );
}
