export type Store = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  font: string;
  price_cents: number;
  currency: string;
  teaser: {
    intro?: string[];
    sample?: { title: string; ingredients: string[]; steps: string[] } | null;
  };
};

export type Category = { id: string; slug: string; name: string; description: string | null; position: number };

export type Ingredient = { raw: string; qty: number | null; rest: string };

export type Recipe = {
  id: string;
  slug: string;
  title: string;
  category_id: string | null;
  position: number;
  photo_path: string | null;
  photo_people_path: string | null;
  yield_text: string | null;
  yield_servings: number;
  time_text: string | null;
  ingredients: Ingredient[];
  steps: string[];
  notes: string[];
  extras: { adelanta?: string; presentacion?: string; conservacion?: string; variacion?: string; variacion_titulo?: string };
};

export type Block =
  | { tipo: "p" | "h"; texto: string }
  | { tipo: "ul"; items: string[] }
  | { tipo: "tabla"; filas: string[][] };

export type Section = { id: string; position: number; title: string; blocks: Block[] };
