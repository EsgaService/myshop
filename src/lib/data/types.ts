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

export type AccountRole = "buyer" | "seller";

export type Profile = {
  id: string;
  role: AccountRole;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
};

export type Seller = {
  id: string;
  slug: string;
  store_name: string;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  instagram: string | null;
  whatsapp: string | null;
  is_platform: boolean;
};

export type BookStatus = "draft" | "published" | "archived";

/** A sellable book (listing metadata only; recipes are loaded separately under RLS). */
export type Book = {
  id: string;
  seller_id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  cover_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  font: string;
  price_cents: number;
  currency: string;
  teaser: Store["teaser"];
  status: BookStatus;
  published_at: string | null;
};

export type BookWithSeller = Book & { seller: Pick<Seller, "id" | "slug" | "store_name" | "is_platform"> };
