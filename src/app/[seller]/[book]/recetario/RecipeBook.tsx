"use client";

import { useEffect, useMemo, useState } from "react";
import type { Block, Category, Recipe, Section } from "@/lib/data/types";
import { photoUrl } from "@/lib/format";
import { scaleIngredient } from "@/lib/recipes/scale";

type Props = {
  storeSlug: string;
  storeName: string;
  categories: Category[];
  sections: Section[];
  recipes: Recipe[];
};

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// localStorage helpers: storage can be blocked (private mode, site data cleared).
function readChecks(key: string): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}
function writeChecks(key: string, value: Record<string, boolean>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore: the checklist still works for this session.
  }
}

export function RecipeBook({ storeSlug, storeName, categories, sections, recipes }: Props) {
  const [view, setView] = useState<"recipes" | number>("recipes");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return recipes.filter((r) => {
      if (categoryId && r.category_id !== categoryId) return false;
      if (!q) return true;
      const haystack = normalize([r.title, ...r.ingredients.map((i) => i.raw)].join(" "));
      return haystack.includes(q);
    });
  }, [recipes, query, categoryId]);

  const open = recipes.find((r) => r.slug === openSlug) ?? null;

  const navBtn = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${active ? "bg-book-primary text-white" : "bg-black/5 hover:bg-black/10"}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <h1 className="mb-3 text-xl font-bold" style={{ color: "var(--brand-primary)" }}>{storeName}</h1>
        <nav aria-label="Secciones del libro" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          <button type="button" className={`${navBtn(view === "recipes")} lg:text-left`} onClick={() => { setView("recipes"); setOpenSlug(null); }}>
            Recetas ({recipes.length})
          </button>
          {sections.map((s, i) => (
            <button key={s.id} type="button" className={`${navBtn(view === i)} lg:text-left`} onClick={() => { setView(i); setOpenSlug(null); }}>
              {s.title}
            </button>
          ))}
        </nav>
      </aside>

      <main className="mt-4 min-w-0 lg:mt-0">
        {view !== "recipes" ? (
          <SectionView section={sections[view]} />
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por receta o ingrediente…"
                aria-label="Buscar recetas"
                className="w-full rounded-full border border-black/20 bg-white px-4 py-2 text-neutral-900"
              />
            </div>
            {categories.length > 0 && (
              <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrar por categoría">
                <button type="button" className={navBtn(categoryId === null)} onClick={() => setCategoryId(null)}>Todas</button>
                {categories.map((c) => (
                  <button key={c.id} type="button" className={navBtn(categoryId === c.id)} onClick={() => setCategoryId(c.id)}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {filtered.length === 0 ? (
              <p className="mt-10 text-center opacity-70">No encontramos recetas con ese filtro.</p>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((r) => (
                  <li key={r.id}>
                    <RecipeCard recipe={r} category={r.category_id ? categoryName.get(r.category_id) : undefined} onOpen={() => setOpenSlug(r.slug)} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      {open && <RecipeDialog storeSlug={storeSlug} recipe={open} onClose={() => setOpenSlug(null)} />}
    </div>
  );
}

function Photo({ path, alt, className = "" }: { path: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = photoUrl(path);
  if (!src || failed) {
    return <div aria-hidden className={`flex items-center justify-center bg-black/5 text-4xl ${className}`}>🍹</div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}

function RecipeCard({ recipe, category, onOpen }: { recipe: Recipe; category?: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="block w-full overflow-hidden rounded-2xl bg-white text-left text-neutral-900 shadow transition hover:shadow-lg">
      <Photo path={recipe.photo_path} alt={recipe.title} className="aspect-[4/3] w-full" />
      <div className="p-4">
        {category && <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--brand-primary)" }}>{category}</p>}
        <h2 className="mt-1 text-lg font-bold">{recipe.title}</h2>
        <p className="mt-1 text-sm text-neutral-600">{[recipe.time_text, recipe.yield_text].filter(Boolean).join(" · ")}</p>
      </div>
    </button>
  );
}

function SectionView({ section }: { section: Section }) {
  return (
    <article className="max-w-prose space-y-4">
      <h2 className="text-2xl font-bold">{section.title}</h2>
      {section.blocks.map((b, i) => <BlockView key={i} block={b} />)}
    </article>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.tipo) {
    case "h":
      return <h3 className="pt-2 text-lg font-bold">{block.texto}</h3>;
    case "ul":
      return <ul className="list-disc space-y-1 pl-5">{block.items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
    case "tabla":
      return (
        <div className="overflow-x-auto rounded-lg border border-black/10">
          <table className="w-full text-left text-sm">
            <tbody>
              {block.filas.map((row, ri) => (
                <tr key={ri} className={ri === 0 ? "bg-black/5 font-semibold" : "border-t border-black/10"}>
                  {row.map((cell, ci) => <td key={ci} className="p-3 align-top">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return <p className="leading-relaxed">{block.texto}</p>;
  }
}

function RecipeDialog({ storeSlug, recipe, onClose }: { storeSlug: string; recipe: Recipe; onClose: () => void }) {
  const storageKey = `recetario:${storeSlug}:${recipe.slug}:checks`;
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [servings, setServings] = useState(recipe.yield_servings);
  const [cooking, setCooking] = useState(false);

  useEffect(() => { setChecks(readChecks(storageKey)); }, [storageKey]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !cooking) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, cooking]);

  const scalable = recipe.ingredients.some((i) => i.qty !== null);
  const factor = servings / recipe.yield_servings;

  function toggle(i: number) {
    const next = { ...checks, [i]: !checks[i] };
    setChecks(next);
    writeChecks(storageKey, next);
  }
  function reset() {
    setChecks({});
    writeChecks(storageKey, {});
  }

  if (cooking) return <CookMode recipe={recipe} onExit={() => setCooking(false)} />;

  const x = recipe.extras;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true" aria-label={recipe.title} onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white text-neutral-900 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <Photo path={recipe.photo_path} alt={recipe.title} className="aspect-[16/9] w-full" />
        <div className="space-y-6 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">{recipe.title}</h2>
              <p className="text-sm text-neutral-600">{[recipe.time_text, recipe.yield_text].filter(Boolean).join(" · ")}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full bg-black/5 px-3 py-1 text-lg">×</button>
          </div>

          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold">Ingredientes</h3>
              {scalable && (
                <div className="flex items-center gap-2 text-sm" aria-label="Porciones">
                  <button type="button" className="h-8 w-8 rounded-full bg-black/10" onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Menos porciones">−</button>
                  <span className="min-w-[5.5rem] text-center">{servings} {servings === 1 ? "porción" : "porciones"}</span>
                  <button type="button" className="h-8 w-8 rounded-full bg-black/10" onClick={() => setServings((s) => Math.min(99, s + 1))} aria-label="Más porciones">+</button>
                </div>
              )}
            </div>
            <ul className="mt-2 space-y-1">
              {recipe.ingredients.map((ing, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-black/5">
                    <input type="checkbox" className="mt-1 h-5 w-5" checked={!!checks[i]} onChange={() => toggle(i)} />
                    <span className={checks[i] ? "line-through opacity-50" : ""}>{scaleIngredient(ing, factor)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button type="button" onClick={reset} className="mt-1 text-sm underline opacity-70">Desmarcar todo</button>
          </section>

          <section>
            <h3 className="text-lg font-bold">Preparación</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {recipe.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </section>

          {(x.adelanta || x.presentacion || x.conservacion || x.variacion || recipe.notes.length > 0) && (
            <section className="space-y-3 rounded-xl bg-black/5 p-4 text-sm">
              {x.adelanta && <p><strong>Qué se adelanta: </strong>{x.adelanta}</p>}
              {x.presentacion && <p><strong>Presentación: </strong>{x.presentacion}</p>}
              {x.conservacion && <p><strong>Conservación: </strong>{x.conservacion}</p>}
              {x.variacion && <p><strong>{x.variacion_titulo ?? "Variación"}: </strong>{x.variacion}</p>}
              {recipe.notes.map((n, i) => <p key={i}>{n}</p>)}
            </section>
          )}

          <button type="button" onClick={() => setCooking(true)} className="w-full rounded-full bg-book-primary px-6 py-3 font-semibold text-white">
            Modo cocina
          </button>
        </div>
      </div>
    </div>
  );
}

function CookMode({ recipe, onExit }: { recipe: Recipe; onExit: () => void }) {
  const [step, setStep] = useState(0);
  const total = recipe.steps.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setStep((s) => Math.min(total - 1, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, onExit]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900 p-5 text-white" role="dialog" aria-modal="true" aria-label={`Modo cocina: ${recipe.title}`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">{recipe.title}</p>
        <button type="button" onClick={onExit} className="rounded-full bg-white/15 px-4 py-2 text-sm">Salir</button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20" aria-hidden>
        <div className="h-full bg-white transition-all" style={{ width: `${total ? ((step + 1) / total) * 100 : 0}%` }} />
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-sm uppercase tracking-widest opacity-70">Paso {step + 1} de {total}</p>
        <p className="mt-3 text-2xl leading-snug sm:text-4xl">{recipe.steps[step]}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="rounded-2xl bg-white/15 py-4 text-lg font-semibold disabled:opacity-30">Anterior</button>
        {step < total - 1 ? (
          <button type="button" onClick={() => setStep(step + 1)} className="rounded-2xl bg-white py-4 text-lg font-semibold text-neutral-900">Siguiente</button>
        ) : (
          <button type="button" onClick={onExit} className="rounded-2xl bg-emerald-400 py-4 text-lg font-semibold text-neutral-900">Listo</button>
        )}
      </div>
    </div>
  );
}
