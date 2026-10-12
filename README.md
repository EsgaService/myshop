# myshop: white-label recipe-book stores

One domain, many recipe books. Each store lives at `/<slug>` (`/cocteles`, `/micheladas`, ...) with its own branding stored in the `stores` table. Next.js (App Router) + Supabase (Postgres, Auth, Storage). Login is Google-only.

## Flow

- `/` catalog of stores.
- `/<slug>` public sales page. Logged in without purchase: redirects to `/<slug>/pagar`. With purchase: `/<slug>/recetario`.
- `/<slug>/pagar` checkout. `/<slug>/recetario` interactive book (RLS-protected data).
- Access decisions live in `src/lib/access/decide-access.ts` (pure, unit-tested).

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the keys (Supabase dashboard > Project Settings > API Keys). `SUPABASE_SERVICE_ROLE_KEY` is server-only.
3. Apply the database schema (nothing is applied automatically):
   - Supabase CLI: `supabase link --project-ref ihbmaydqjsoynsiugzfv && supabase db push`
   - or paste `supabase/migrations/*.sql` into the SQL editor.
4. Seed stores: run `supabase/seed.sql`.
5. Generate and run the book content (SQL files are in `supabase/seed-books/`, already generated for `micheladas` and `cocteles`):
   ```bash
   npm run import:book -- "<path to pdf-bebidas>/02-micheladas" --store micheladas          # regenerate SQL
   npm run import:book -- "<path to pdf-bebidas>/02-micheladas" --store micheladas --apply  # or upsert directly via service role
   ```
   Photos are not uploaded yet: `recipes.photo_path` holds `<store>/<file>` for the public `recipe-photos` bucket; missing images show a placeholder.
6. Enable Google in Supabase: Authentication > Providers > Google, with a Google Cloud OAuth client whose authorized redirect URI is
   `https://ihbmaydqjsoynsiugzfv.supabase.co/auth/v1/callback`.
   Also in Authentication > URL Configuration, set Site URL and add `http://localhost:3000/auth/callback` and your production `/auth/callback` to the redirect allow-list.

## Run

```bash
npm run dev      # http://localhost:3000
npm test         # Vitest
npm run build
```

## Payments

`src/lib/payments` defines the `PaymentProvider` port. `MockPaymentProvider` confirms any payment only when `PAYMENTS_MODE=mock`; otherwise the checkout endpoint returns 403. The `purchases` row is written server-side with the service role (`fulfill.ts`), tied to the auth user id, with price taken from the database. To add a real gateway, implement `createCheckout` (return `{ status: "redirect", url }`) and `parseWebhook` (verify the signature), then register it in `getPaymentProvider`; `/api/webhooks/payments` already grants access on `payment.succeeded`.

## Security model

RLS is on every table. `stores` and `recipe_categories` are public; `recipes` and `book_sections` are readable only with a `purchases` row for that store; `purchases` is readable by its owner. No client write policies exist anywhere. `stores.teaser` is intentionally public marketing content.
