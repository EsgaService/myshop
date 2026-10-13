"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveUpload } from "@/app/vendedor/(panel)/productos/actions";
import type { MovablePdf } from "@/lib/seller/movable-pdfs";
import { AddExistingPdfsForm } from "./AddExistingPdfsForm";

type Line = { name: string; ok: boolean; message?: string };

/**
 * Moves the selected READY PDFs of other products into this one, one by one through `moveUpload`
 * (the server re-checks ownership, plan and every guard per PDF). Each PDF reports its own result.
 */
export function AddExistingPdfsControl({ target, pdfs }: { target: { id: string; title: string }; pdfs: MovablePdf[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [lines, setLines] = useState<Line[]>([]);
  const [needsPlan, setNeedsPlan] = useState(false);

  if (pdfs.length === 0 && lines.length === 0) return null;

  function toggle(uploadId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(uploadId)) next.add(uploadId);
      return next;
    });
  }

  function add() {
    const chosen = pdfs.filter((p) => selected.has(p.id));
    if (chosen.length === 0) return;
    const what = chosen.length === 1 ? "Este PDF saldrá" : `Estos ${chosen.length} PDF saldrán`;
    if (
      !window.confirm(
        `${what} de su producto actual y pasará${chosen.length === 1 ? "" : "n"} a «${target.title}». Quienes ya compraron el producto de origen dejarán de ver esas recetas allí y el PDF dejará de aparecer en sus descargas. ¿Continuar?`,
      )
    ) {
      return;
    }
    setLines([]);
    setNeedsPlan(false);
    startTransition(async () => {
      const results: Line[] = [];
      const moved = new Set<string>();
      for (const pdf of chosen) {
        try {
          const result = await moveUpload(pdf.id, target.id);
          if (result.ok) {
            moved.add(pdf.id);
            results.push({ name: pdf.name, ok: true });
          } else {
            results.push({ name: pdf.name, ok: false, message: result.message });
            if (result.code === "subscription_required") {
              setNeedsPlan(true);
              break; // every remaining move would fail the same way
            }
          }
        } catch {
          results.push({ name: pdf.name, ok: false, message: "Ocurrió un error inesperado. Inténtalo de nuevo." });
        }
      }
      setLines(results);
      setSelected((current) => new Set([...current].filter((id) => !moved.has(id))));
      router.refresh();
    });
  }

  return (
    <details className="rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">Añadir PDF existentes</summary>
      <div className="mt-3">
        <AddExistingPdfsForm
          bookId={target.id}
          pdfs={pdfs}
          selected={selected}
          pending={pending}
          onToggle={toggle}
          onAdd={add}
          feedback={
            lines.length > 0 && (
              <ul className="space-y-1 text-xs" aria-live="polite">
                {lines.map((line, i) => (
                  <li key={`${i}-${line.name}`} className={line.ok ? "text-success" : "text-danger"}>
                    <span className="font-medium">{line.name}</span>: {line.ok ? "añadido." : line.message}
                    {!line.ok && needsPlan && i === lines.length - 1 && (
                      <>
                        {" "}
                        <Link href="/vendedor/suscripcion" className="font-medium underline">
                          Activa tu suscripción
                        </Link>
                        .
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )
          }
        />
      </div>
    </details>
  );
}
