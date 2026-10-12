import { Logo } from "@/components/ui/Logo";
import { Notice } from "@/components/ui/Notice";
import { LEGAL_REVIEW_NOTICE, type LegalDocument } from "@/lib/legal/content";

export function LegalPage({ doc }: { doc: LegalDocument }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Logo className="mb-10" />
      <Notice>{LEGAL_REVIEW_NOTICE}</Notice>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{doc.title}</h1>
      {doc.sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="font-display text-xl font-semibold">{s.heading}</h2>
          {s.body.map((p) => (
            <p key={p} className="mt-2 text-fg-muted">
              {p}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
