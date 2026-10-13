# myshop: recipe-book marketplace

Sellers upload recipe PDFs, an AI turns them into interactive recipe books, and buyers purchase and read them. Next.js (App Router) + Supabase (Postgres, Auth, Storage). Login is Google-only. Accounts are either `buyer` or `seller`, never both.

## Flow

- `/` public landing. `/ingresar` buyer sign-in, `/vendedor/ingresar` seller sign-in.
- Buyers: `/explorar` (marketplace), `/<seller>/<book>` (product page), `/<seller>/<book>/pagar` (checkout), `/<seller>/<book>/recetario` (interactive book), `/mis-recetarios` (library).
- Sellers: `/vendedor` (dashboard), `/vendedor/productos` (create a product, upload one or several PDFs into it, remove PDFs, set price, publish, copy share link), `/vendedor/suscripcion` (monthly plan, required to upload PDFs, publish and be listed), `/vendedor/perfil`.
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
| `PAYMENTS_MODE` | `mock` accepts any payment (development only, never in production). `wompi` uses Wompi Web Checkout |
| `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_SECRET` | Wompi credentials, server only. Sandbox (`pub_test_`...) or production (`pub_prod_`...), never mixed. Sandbox keys are refused in production |
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

A seller creates a product (a named draft book) and uploads one or several PDFs into it, straight to the private `seller-pdfs` bucket through signed URLs; each PDF is its own upload and job, and the 12-PDF cap counts across all products. Every PDF is merged into its product by the same RPC: categories merge by slug, recipes and sections are appended in upload order, and each row records the upload that produced it so a single PDF can be removed later (`remove_upload_from_book()`; the last ready PDF of a published product cannot be removed). Buyers (and the owner) can download the original PDFs of a book from the reader through `GET /api/books/[bookId]/pdfs/[uploadId]`, which answers 404 on any denial or 302 to a 60 s signed URL; the storage path is never exposed. Confirming the upload enqueues a row in `ingestion_jobs`; the worker (`src/lib/ingestion/worker.ts`) is kicked in-process with `after()`, claims the job with `claim_ingestion_job()` and sends the PDF to the `AiBookProvider`. The structured result is validated with Zod and merged atomically by `create_book_from_ingestion()` into the product. Uploading and retrying require an active subscription because every run is billed by the AI provider. Failures retry with backoff (3 attempts, a stale job is never reclaimed past that), then show a readable error; the seller can retry manually up to 3 times per upload. At most 3 jobs run at once and every AI call is aborted before the route `maxDuration`. In production, schedule a cron calling `POST /api/ingestion/run` with `Authorization: Bearer $INGESTION_WORKER_SECRET` as a safety net.

## Payments

`src/lib/payments` defines the `PaymentProvider` port with two kinds: `purchase` (a buyer buys a book) and `subscription` (a seller pays the monthly plan). `MockPaymentProvider` confirms any payment only when `PAYMENTS_MODE=mock` and never in production. Rows in `purchases` and `subscriptions` are written server-side with the service role (`fulfill.ts`), tied to the auth user, with amounts taken from the database or `SELLER_PLAN`. **Wompi (`PAYMENTS_MODE=wompi`).** The platform's single Wompi account collects ALL payments (book purchases and the seller subscription); sellers fill a "Cuenta para pagos" (`/vendedor/pagos`) and the platform disburses their earnings manually. Flow: `createCheckout` stores a row in `payment_checkouts` (reference, kind, subject, user, amount; service role only) and redirects the browser to Wompi's hosted checkout with a server-computed integrity signature. Access is granted only (1) by the webhook `POST /api/webhooks/payments`, which verifies the event checksum (`X-Event-Checksum`, constant-time, property list read from each event) and checks amount, currency and environment against the stored checkout, or (2) by the return page `/pagos/resultado?id=<txId>` (`/pagos/resultado/suscripcion` for the seller plan), which reads the transaction from Wompi server-to-server with the private key and reconciles through the same idempotent path (this is what makes it work on localhost, where the webhook cannot arrive). The redirect alone never grants access. In the Wompi dashboard (Developers > Events) set the Events URL to `https://<domain>/api/webhooks/payments`, separately for Sandbox and Production. To add another gateway, implement `createCheckout` and `parseWebhook` and register it in `getPaymentProvider`.

## Security model

RLS is on every table and is read-only for clients. Books are visible when published by a seller with an active subscription, to their owner, or to buyers who purchased them. `recipes` and `book_sections` are readable only by purchasers and the owner. All writes go through server actions or API routes using the service role, behind `requireSeller()`/`requireBuyer()`. See `supabase/tests/marketplace_rls_checks.sql`.

## Legal

`/privacidad` and `/terminos` are generic documents. They reference Colombia's Ley 1581 de 2012 and should be reviewed by a lawyer before scaling.
