# myshop: recipe-book marketplace

Sellers upload recipe PDFs, an AI turns them into interactive recipe books, and buyers purchase and read them. Next.js (App Router) + Supabase (Postgres, Auth, Storage). Login is Google-only. Accounts are either `buyer` or `seller`, never both.

## Flow

- `/` public landing. `/ingresar` buyer sign-in, `/vendedor/ingresar` seller sign-in.
- Buyers: `/explorar` (marketplace), `/<seller>/<book>` (product page), `/<seller>/<book>/pagar` (checkout), `/<seller>/<book>/recetario` (interactive book), `/mis-recetarios` (library).
- Sellers: `/vendedor` (dashboard), `/vendedor/productos` (upload PDFs, set price, publish, copy share link), `/vendedor/suscripcion` (monthly plan, required to publish and be listed), `/vendedor/perfil`.
- `/privacidad` and `/terminos` are placeholders pending legal review.
- Legacy `/cocteles/**` and `/micheladas/**` redirect (308) to `/myshop/<slug>/**`.
- Access decisions live in `src/lib/access/decide-access.ts` and `src/lib/auth/decide-area.ts` (pure, unit-tested).

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the keys (Supabase dashboard > Project Settings > API Keys). `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` are server-only.
3. Apply the database migrations (nothing is applied automatically):
   - Supabase CLI: `supabase link --project-ref ihbmaydqjsoynsiugzfv && supabase db push`
   - or paste `supabase/migrations/*.sql` in order into the SQL editor.
4. Seed the legacy books (optional): run `supabase/seed.sql`, then `supabase/seed-books/*.sql`, or regenerate:
   ```bash
   npm run import:book -- "<path to pdf-bebidas>/02-micheladas" --store micheladas          # regenerate SQL
   npm run import:book -- "<path to pdf-bebidas>/02-micheladas" --store micheladas --apply  # or upsert directly via service role
   ```
5. Enable Google in Supabase: Authentication > Providers > Google, with a Google Cloud OAuth client whose authorized redirect URI is
   `https://ihbmaydqjsoynsiugzfv.supabase.co/auth/v1/callback`.
   Also in Authentication > URL Configuration, set Site URL and add `http://localhost:4000/auth/callback` and your production `/auth/callback` to the redirect allow-list.

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project and publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret key |
| `PAYMENTS_MODE` | `mock` accepts any payment (development only). Never `mock` in production |
| `NEXT_PUBLIC_SITE_URL` | Public origin (OAuth redirects, share links) |
| `AI_PROVIDER` | `mock` or `anthropic`. Empty: anthropic if `ANTHROPIC_API_KEY` is set, else mock |
| `ANTHROPIC_API_KEY` | Claude API key (server-only) |
| `ANTHROPIC_MODEL` | Default `claude-sonnet-5-5` |
| `INGESTION_WORKER_SECRET` | Bearer secret for `POST /api/ingestion/run` (fails closed when empty) |

## Run

```bash
npm run dev      # http://localhost:4000
npm test         # Vitest
npm run typecheck
npm run build
```

## AI ingestion

A seller uploads a PDF straight to the private `seller-pdfs` bucket through a signed URL. Confirming the upload enqueues a row in `ingestion_jobs`; the worker (`src/lib/ingestion/worker.ts`) is kicked in-process with `after()`, claims the job with `claim_ingestion_job()` and sends the PDF to the `AiBookProvider`. The structured result is validated with Zod and stored atomically by `create_book_from_ingestion()` as a draft book. Failures retry with backoff (3 attempts), then show a readable error. In production, schedule a cron calling `POST /api/ingestion/run` with `Authorization: Bearer $INGESTION_WORKER_SECRET` as a safety net.

## Payments

`src/lib/payments` defines the `PaymentProvider` port with two kinds: `purchase` (a buyer buys a book) and `subscription` (a seller pays the monthly plan). `MockPaymentProvider` confirms any payment only when `PAYMENTS_MODE=mock` and never in production. Rows in `purchases` and `subscriptions` are written server-side with the service role (`fulfill.ts`), tied to the auth user, with amounts taken from the database or `SELLER_PLAN`. To add a real gateway, implement `createCheckout` and `parseWebhook` (verify the signature), then register it in `getPaymentProvider`; `/api/webhooks/payments` already dispatches by kind.

## Security model

RLS is on every table and is read-only for clients. Books are visible when published by a seller with an active subscription, to their owner, or to buyers who purchased them. `recipes` and `book_sections` are readable only by purchasers and the owner. All writes go through server actions or API routes using the service role, behind `requireSeller()`/`requireBuyer()`. See `supabase/tests/marketplace_rls_checks.sql`.

## Legal

`/privacidad` and `/terminos` are placeholders ("Documento en revisión legal"). They reference Colombia's Ley 1581 de 2012 and must be reviewed by a lawyer before launch.
