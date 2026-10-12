# MyShop: project context

White-label stores that sell interactive recipe books (digital products, Colombian market, prices in COP). One domain, many stores at `/<slug>`, with branding stored per row in `stores`. See `README.md` for setup, flow, payments and the security model. This file covers current state and the non-obvious details.

## Stack

Next.js 16 (App Router, `src/proxy.ts` refreshes the session) + React 19 + Tailwind 4 + Supabase (Postgres, Auth, Storage) + Vitest. TypeScript. UI copy is in neutral Spanish ("tú"); code, comments and docs are in English.

## Routes

- `/`: store catalog.
- `/<slug>`: public sales page. Uses `stores.teaser`, a free sample that is public on purpose.
- `/<slug>/pagar`: checkout. `PAYMENTS_MODE=mock` accepts any payment; any other value returns 403.
- `/<slug>/recetario`: interactive book with search, category filter, checkable ingredients, servings scaling (`src/lib/recipes/scale.ts`) and step-by-step cooking mode.
- `/auth/callback` (code exchange, `next` validated by `safe-next.ts`) and `/auth/signout`.
- Access routing logic: `src/lib/access/decide-access.ts` (pure, unit-tested).

## Architecture rules (do not break)

- Recipes and book sections are delivered ONLY by RLS to users with a `purchases` row for that store.
- `purchases` is written ONLY server-side with the service role (`src/lib/payments/fulfill.ts`). The price comes from `stores.price_cents`, never from the client.
- No client write policies exist on any table. Keep it that way.
- Payments follow the port/adapter pattern: `PaymentProvider` in `src/lib/payments/types.ts`, with `MockPaymentProvider` as the only adapter today. `/api/webhooks/payments` grants access on `payment.succeeded`.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only (`src/lib/supabase/admin.ts`, which imports `server-only`).

## Supabase

- Project ref `ihbmaydqjsoynsiugzfv`. The MCP server `supabase-myshop` is configured in `.mcp.json`.
- Applied on 2026-10-11:
  - migration `init_schema` (5 tables, RLS, grants, public bucket `recipe-photos`)
  - `seed.sql` (stores `cocteles` and `micheladas`)
  - `seed-books/*.sql`
- Loaded content: micheladas has 22 recipes, 3 categories and 3 book sections. cocteles has 27 recipes, 5 categories and no sections, because its source JSON had none.
- RLS verified: `anon` sees stores and categories only. An authenticated user without a purchase sees 0 recipes and 0 sections. Not yet verified: a buyer seeing their recipes (needs a real Google user).
- Advisors: security is clean. Performance shows only `unused_index` (INFO), which is expected on a fresh DB.

## Gotchas

- **The MCP `execute_sql` rejects any `DELETE`** with `Invalid or expired requestState`: its confirmation step for destructive statements fails in this client. The first seed load skipped line 5 (`delete from book_sections`) of each seed-book file, which was a no-op on empty tables. **Re-running a seed-book through the MCP would duplicate `book_sections`.** Re-import through the Dashboard SQL editor, the Supabase CLI, or `npm run import:book -- ... --apply`.
- Writing `.env*` files is blocked by the local Claude permission settings. The user creates `.env.local` by hand from `.env.example`.
- Google OAuth redirect URI in Google Cloud must be the Supabase one: `https://ihbmaydqjsoynsiugzfv.supabase.co/auth/v1/callback`. `http://localhost:3000/auth/callback` goes in Supabase > Auth > URL Configuration > Redirect URLs.

## Pending assumptions (review before launch)

- Prices are placeholders: 19.900 COP (`price_cents = 1990000`) in both stores.
- Colors and fonts per store are a proposal. Adjust them in the `stores` table.
- Photos: none uploaded yet, so missing images show a placeholder. The `recipe-photos` bucket is public, so anyone with a direct photo URL can see the photo without paying. The recipe text stays protected.
- No real payment gateway yet, only the mock.

## Next steps

1. The user creates the Google Cloud OAuth client and enables Google in Supabase Auth with Site URL and Redirect URLs set for localhost.
2. The user fills `.env.local`, including `SUPABASE_SERVICE_ROLE_KEY`.
3. Local end-to-end test: log in with Google, mock-pay on `/cocteles/pagar`, open `/cocteles/recetario`. Then verify in the DB that the `purchases` row exists and that the buyer sees 27 recipes.
4. Later: real prices, photos (decide whether to use a private bucket with signed URLs), a real payment gateway, a production domain and its OAuth redirect URLs.

## Commands

`npm run dev` · `npm test` (49 tests) · `npm run typecheck` · `npm run build` · `npm run import:book -- "<dir>" --store <slug> [--apply]`
