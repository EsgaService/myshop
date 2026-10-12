import type { AiBook } from "@/lib/ingestion/ai-book-schema";
import type { AiBookProvider } from "./types";

function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "Recetario sin título";
}

/** Deterministic fixture used when no AI key is configured (dev, tests). */
export class MockAiBookProvider implements AiBookProvider {
  readonly id = "mock" as const;

  async extractBook(input: { pdfBase64: string; fileName: string }): Promise<AiBook> {
    const title = titleFromFileName(input.fileName);
    return {
      title,
      tagline: "Recetas para disfrutar en casa",
      description: `Recetario generado automáticamente a partir de ${input.fileName}.`,
      categories: [
        { name: "Entradas", description: "Para empezar" },
        { name: "Platos fuertes" },
      ],
      sections: [
        {
          title: "Introducción",
          blocks: [
            { tipo: "h", texto: "Antes de empezar" },
            { tipo: "p", texto: "Lee cada receta completa antes de cocinar." },
            { tipo: "ul", items: ["Mide los ingredientes", "Precalienta el horno"] },
          ],
        },
      ],
      recipes: [
        {
          title: "Ensalada de la casa",
          category: "Entradas",
          yield: "4 porciones",
          time: "15 min",
          ingredients: ["2 tazas de lechuga", "1 tomate", "2 cucharadas de aceite de oliva"],
          steps: ["Lava y corta los vegetales.", "Mezcla con el aceite y sirve."],
          notes: ["Se puede preparar con un día de anticipación."],
          extras: {},
        },
        {
          title: "Pollo al horno",
          category: "Platos fuertes",
          yield: "6 porciones",
          time: "1 h 30 min",
          ingredients: ["1 pollo entero", "3 dientes de ajo", "1 cucharadita de sal"],
          steps: ["Sazona el pollo.", "Hornea a 180 °C hasta que esté dorado."],
          notes: [],
          extras: {},
        },
      ],
    };
  }
}
