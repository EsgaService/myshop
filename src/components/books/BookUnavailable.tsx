import { ButtonLink } from "@/components/ui/Button";

/** Shown at a share link whose book cannot be sold or read right now (R8). */
export function BookUnavailable() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-semibold">Este recetario no está disponible</h1>
      <p className="mt-2 text-fg-muted">El vendedor lo retiró temporalmente. Puedes explorar otros recetarios mientras tanto.</p>
      <ButtonLink href="/explorar" className="mt-6">Explorar recetarios</ButtonLink>
    </main>
  );
}
