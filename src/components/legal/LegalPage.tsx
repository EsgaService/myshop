import { Logo } from "@/components/ui/Logo";
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, LEGAL_OWNER, type LegalDocument } from "@/lib/legal/content";

export function LegalPage({ doc, showOwner = false }: { doc: LegalDocument; showOwner?: boolean }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Logo className="mb-10" />
      <h1 className="font-display text-3xl font-semibold tracking-tight">{doc.title}</h1>
      <p className="mt-2 text-sm text-fg-muted">Última actualización: {LEGAL_LAST_UPDATED}</p>
      {showOwner && (
      <aside aria-labelledby="legal-info" className="mt-6 rounded-2xl border border-border bg-surface p-5 text-sm">
        <h2 id="legal-info" className="font-display text-base font-semibold">Información legal</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-fg-muted">
          <dt className="font-medium text-fg">Responsable</dt>
          <dd>{LEGAL_OWNER.name}</dd>
          <dt className="font-medium text-fg">Tipo de persona</dt>
          <dd>{LEGAL_OWNER.personType}</dd>
          <dt className="font-medium text-fg">Documento</dt>
          <dd>{LEGAL_OWNER.documentType} {LEGAL_OWNER.documentNumber}</dd>
          <dt className="font-medium text-fg">Correo</dt>
          <dd>
            <a className="underline underline-offset-2" href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a>
          </dd>
          <dt className="font-medium text-fg">País</dt>
          <dd>{LEGAL_OWNER.country}</dd>
        </dl>
      </aside>
      )}
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
