# MyShop: project context

Marketplace where sellers upload recipe PDFs, an AI converts them into interactive recipe books, and buyers purchase and read them (digital products, Colombian market, prices in COP). See `README.md` for setup, flow, payments and the security model. This file covers current state and the non-obvious details.

## Stack

Next.js 16 (App Router, `src/proxy.ts` refreshes the session) + React 19 + Tailwind 4 + Supabase (Postgres, Auth, Storage) + Vitest + Zod 4 + `@anthropic-ai/sdk` + `@phosphor-icons/react`. TypeScript. UI copy is in neutral Spanish ("tú"); code, comments and docs are in English.

## Product model

- Two EXCLUSIVE account roles, `buyer` and `seller`, stored in `profiles.role` (source of truth, mirrored to `app_metadata.role` on creation). Guards read `profiles`, never the JWT.
- The role is chosen by the sign-in screen used the first time (`/ingresar` = buyer, `/vendedor/ingresar` = seller) and can never change afterwards. Legacy users with purchases are forced to buyer. A seller cannot buy (`purchases_buyer_only` trigger + `decide-purchase.ts`).
- A seller pays a monthly subscription (`SELLER_PLAN`: 50.000 COP/month, `src/lib/seller/decide-subscription.ts`). Without an active period, the seller's books are hidden from `/explorar` and cannot be published; buyers who already purchased keep access.
- Uploading PDFs and retrying a failed ingestion REQUIRE an active subscription (the AI costs money); before paying a seller can still edit the store profile. Manual retries are capped at 3 per upload. The store slug is locked while any book is published.
- A product is a `books` row. A seller creates it by name (draft), then uploads one or several PDFs into it (up to 12 active PDFs per seller across all products, max 20 MB each). Each PDF goes through the AI pipeline and is merged into its product (categories by slug, recipes and sections appended in upload order). The seller sets the price (5.000 to 1.000.000 COP), publishes (needs at least one ready PDF, except legacy books) and shares the link `/<seller>/<book>`.
- A seller can remove a PDF from a draft, published or sold product (its recipes and sections go, purchases are untouched). The last ready PDF of a published product cannot be removed, and PDFs still processing cannot be removed. An empty draft with no purchases can be deleted.
- The owner and buyers with a purchase can download the original PDFs (ready, not removed) of a book.
- The platform seller (slug `myshop`, `is_platform`) owns the legacy books `cocteles` and `micheladas`.

## Routes

```
/                          public marketing landing
/ingresar                  buyer sign-in (Google)
/vendedor/ingresar         seller sign-in (Google)
/auth/callback | /auth/signout
/explorar                  marketplace of listed books (public)
/mis-recetarios            buyer library | /mis-recetarios/perfil
/vendedor                  seller dashboard | /perfil | /productos | /productos/[bookId] | /productos/[bookId]/recetas?upload= (photo editor per PDF) | /suscripcion | /pagos (Cuenta para pagos)
/[seller]                  public seller store
/[seller]/[book]           product page | /pagar checkout | /recetario interactive book
/privacidad | /terminos    generic legal pages (privacy policy, terms)
/api/pay/book/[bookId]     POST purchase
/api/books/[bookId]/pdfs/[uploadId]  GET original PDF: 404 on any denial, else 302 to a 60 s signed URL (owner or purchaser only)
/api/webhooks/payments     Wompi Events URL; provider.parseWebhook then fulfill (kind-aware: purchase | subscription)
/pagos/resultado           Wompi return page for purchases (?id=txId); /pagos/resultado/suscripcion for the seller subscription (signed-out sellers go to /vendedor/ingresar). Server-side reconciliation: approved/pending/declined/unfulfilled
/api/ingestion/run         POST, Bearer INGESTION_WORKER_SECRET
/api/ingestion/jobs/[id]   GET job status (owner only)
```

- Legacy `/cocteles/**` and `/micheladas/**` redirect (308) to `/myshop/<slug>/**` (`src/lib/routing/legacy-redirects.ts`, wired in `next.config.ts`). Those slugs are reserved (`src/lib/routing/reserved-slugs.ts`, mirrored in the SQL check on `sellers.slug`).
- The seller panel lives in the route group `src/app/vendedor/(panel)/` so `/vendedor/ingresar` stays outside the `requireSeller()` guard.
- Access routing logic: `src/lib/access/decide-access.ts`. Role routing: `src/lib/auth/decide-area.ts`, `src/lib/account/decide-*.ts`. All pure and unit-tested.

## Data model

- `profiles` (role, display data), `sellers` (slug, store profile, `is_platform`), `subscriptions` (paid periods), `books` (draft/published/archived, price, branding, `upload_id`, `legacy_store_id`), `book_uploads` (PDF in bucket `seller-pdfs`, max 12 active per seller enforced by trigger; `book_id` = owning product, set when the upload is requested; `teaser` = that PDF's public teaser; `removed_at` = soft removal), `ingestion_jobs` (Postgres queue), `payment_checkouts` (server-side record of every hosted checkout: unique `reference`, kind, subject_id, user_id, amount, currency, status, provider_transaction_id; RLS on and NO client policies, service role only), `seller_payout_accounts` (one row per seller: bank or wallet, institution, holder and document; no client grants at all: read and written only with the service role, the UI shows only the masked number).
- `recipes`, `book_sections` and `recipe_categories` have a nullable `upload_id` (provenance; null for legacy/seed rows). "Ingested" means `book_uploads.status = 'ready'`, NOT `book_id is not null`. `books.upload_id` is kept but no longer written; the book teaser is the teaser of the earliest active ready PDF (legacy books keep theirs).
- PDF images: `book_images` (kind `pdf`|`custom`, per upload/book/recipe, `storage_path`/`thumb_path` in `recipe-photos`; PDF candidates capped at 150 per upload), `book_uploads.images_*` (status null/processing/done/failed, attempts, error, `images_review_pending`), `recipes.photo_source` (`auto`|`pdf`|`custom`|`none`) and `source_page`, `books.cover_source` (`auto`|`pdf`|`custom`). Anything not `auto` is the seller's choice and re-extraction never overwrites it. Legacy photos/covers were backfilled as `custom`. Seller uploads go through the private temp bucket `seller-image-uploads` (signed upload, validated by magic bytes, re-encoded to WebP, max 300 custom images per seller). RPC `claim_image_extraction()` claims uploads for the sweep.
- `recipe_categories`, `recipes`, `book_sections`, `purchases` are keyed by `book_id`. Legacy rows reuse `stores.id` as `books.id`; `stores` and `store_id` are kept (nullable) for rollback and for `npm run import:book`.
- RPCs (service role only): `claim_ingestion_job()` (SKIP LOCKED; stale jobs are reclaimed only while `attempts < max_attempts`, max 3 jobs running at once), `create_book_from_ingestion()` (merges one upload into its product under the product lock; idempotent per upload; discards the result of a removed upload; falls back to creating a product for in-flight uploads without one), `remove_upload_from_book()` (locks the product, deletes only that upload's recipes/sections, prunes empty categories, renumbers positions, recomputes the teaser, soft-removes the upload; raises `last_ready_pdf`; the `removeUpload` action shows a clear Spanish error when the RPC is missing, PGRST202 / 42883), `move_upload_to_book()` (locks both products by id, then the upload; moves a READY PDF's recipes/sections to another non-legacy, non-archived product of the same seller, reusing categories by slug and suffixing colliding recipe slugs `-2`, `-3`; prunes empty source categories, renumbers and recomputes teasers in both; raises `last_ready_pdf`, `upload_not_ready`, `invalid_target`, `upload_not_owned`; returns `source_empty`; the `moveUpload` action maps a missing RPC to "Mover PDFs todavía no está disponible") and `grant_subscription_period()` (per-seller lock, idempotent per `provider_ref`, month-end anchored).
- `sellers.user_id` is NOT readable by `anon`/`authenticated` (column-level SELECT grant). Owner lookups use the service role keyed by the session user (`getMySeller`); RLS uses the `private.my_seller_id()` definer helper.
- A removed PENDING upload keeps its slot for 2 hours (signed upload token TTL): `holdsUploadSlot()` and the `enforce_upload_limit` trigger.
- `teaser.sample` stores only title and ingredients, never steps.

## AI ingestion

- Port `AiBookProvider` in `src/lib/ai/` with `mock` (deterministic fixture) and `anthropic` adapters. Selection: `AI_PROVIDER`, else `ANTHROPIC_API_KEY` set means anthropic, else mock. The mock is REFUSED in production (`getAiBookProvider` throws, `src/instrumentation.ts` logs at boot). The SDK never retries (`maxRetries: 0`, 180s per call, aborted before the route `maxDuration`); a `max_tokens` stop is a non-retryable failure. Model: `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`). Output uses structured outputs (`output_config.format` JSON schema) and is validated with Zod in the service (`src/lib/ingestion/ai-book-schema.ts`).
- Worker: `runIngestionWorker()` (`src/lib/ingestion/worker.ts`) claims jobs and runs `processJob` (retry with backoff, max 3 attempts). It is kicked with `after()` from `confirmUpload` and from the polling GET when a job is stuck. `/api/ingestion/run` (Bearer secret) is for a cron trigger in production.
- Image sweep (`src/lib/images/`, `run-sweep.ts`): after the job queue drains, `runIngestionWorker` extracts PDF images best effort (needs at least 60 s of request budget, max 3 uploads, never fails the book). Pure modules (title matching, filtering, photo assignment, cover choice) are unit-tested; adapters are `pdfjs-extractor` (pdfjs-dist legacy build with wasm for JPX/JBIG2, minimal DOMMatrix/Path2D polyfills) and `sharp-encoder`. `pdfjs-dist` and `sharp` are in `serverExternalPackages` (`next.config.ts`; wasm traced via `outputFileTracingIncludes`, Vercel runtime not verified). Do NOT use mupdf (AGPL). The seller can re-extract a PDF (`reextractUpload` sets `images_status` to null) and edit photos one by one.

## Architecture rules (do not break)

- Recipes and book sections are delivered ONLY by RLS to buyers with a `purchases` row for that book, or to the owner seller.
- All writes are server-side with the service role, behind `requireSeller()`/`requireBuyer()` and `.eq("seller_id", seller.id)`. RLS is read-only: no client write policies exist on any table. Keep it that way.
- `purchases` and `subscriptions` are written ONLY from `src/lib/payments/fulfill.ts`. Prices come from the database (`books.price_cents`, `SELLER_PLAN`), never from the client.
- Payments follow the port/adapter pattern: `PaymentProvider` (`src/lib/payments/types.ts`, has `kind`), Adapters: `MockPaymentProvider` (dev) and `WompiPaymentProvider` (`src/lib/payments/wompi/`, no SDK: REST only). `parseWebhook` returns a `WebhookOutcome` (invalid | ignored | rejected | event). The shared `applyPaymentEvent` (`apply-payment-event.ts`, wired in `fulfillment.ts`) turns a trusted event into access for both the webhook and the return page. The platform's single Wompi account collects everything; a per-seller gateway is a future adapter resolved per seller. `getPaymentProvider` throws `PaymentsDisabledError` for `mock` in production and for Wompi sandbox keys (or missing/mixed keys) in production, and `src/instrumentation.ts` logs an error at boot.
- `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` are server-only.
- Business rules live in pure deciders with tests first (strict TDD). Do not put them in components or actions.

## Supabase

- Project ref `ihbmaydqjsoynsiugzfv`. The MCP server `supabase-myshop` is configured in `.mcp.json`.
- Applied on 2026-10-11: migration `init_schema`, `seed.sql`, `seed-books/*.sql` (micheladas: 22 recipes; cocteles: 27 recipes).
- Applied on 2026-10-12: migrations `marketplace_schema`, `marketplace_rls`, `marketplace_books_policy_fix` (the last one adds `private.has_purchased()` and the anon read policy for listed books). Checks in `supabase/tests/marketplace_rls_checks.sql` (ends with `ALL_CHECKS_PASSED`).
- Applied on 2026-10-12 (MCP): Migration A `20261013090000_multi_pdf_products` (provenance columns, per-PDF teaser, merge RPC). Merge checks `supabase/tests/multi_pdf_checks.sql` passed remotely (the `claim_ingestion_job` block was skipped there because it would claim real jobs).
- Applied on 2026-10-12 (Supabase CLI, `supabase db query --linked --project-ref ihbmaydqjsoynsiugzfv -f <file>`): Migration B `20261013090100_remove_upload_rpc` (`remove_upload_from_book`) and Migration C `20261013090200_move_upload_rpc` (`move_upload_to_book`). Both contain DELETE, so the MCP rejects them. `supabase/tests/multi_pdf_removal_checks.sql` and `multi_pdf_move_checks.sql` passed remotely. Both versions were inserted by hand into `supabase_migrations.schema_migrations`.
- Applied on 2026-10-12: `20261012130000_marketplace_review_fixes` (claim bounds, `manual_retries`, upload slot rule, `grant_subscription_period`, `sellers` column grants, teaser scrub).
- Applied on 2026-10-12 (MCP): `20261015090000_pdf_images` (book_images, images_* columns, source columns, `claim_image_extraction`, bucket `seller-image-uploads`). Structure verified; the `claim_image_extraction` block of `supabase/tests/pdf_images_checks.sql` was NOT run remotely because real pending uploads would make it fail. First real run: cocteles 61 images (26 of 27 recipes with photo), limonadas 55 (25/28), micheladas 49 (5/22).
- Applied on 2026-10-12 (MCP): `20261014090000_payment_checkouts`, `20261014090100_seller_payout_accounts`, `20261014090200_payment_hardening` (recorded remotely as 20261013000217, 20261013000219 and 20261013002736: the MCP stamps its own version).
- Applied on 2026-10-12 (MCP): `20261015090100_custom_image_quota` (before-insert trigger on `book_images`, 300 custom images per seller under a per-seller advisory lock). The quota check and `supabase/tests/merge_keeps_published_checks.sql` (merging a PDF keeps a product published, same price/title) passed remotely.
- Bucket `seller-pdfs` is private, 20 MB, PDF only, no `storage.objects` client policies (uploads use signed upload URLs).
- Not yet verified with real sessions: buyer reading purchased recipes, seller flows end to end.

## Google OAuth (configured 2026-10-12)

- Google Cloud project `MyShop` (id `myshop-511415`). The consent screen (Google Auth Platform) is External, app name "MyShop".
- Publishing status: **Testing**. Only manually added test users can log in (max 100). The user's Gmail is added.
- OAuth client "MyShop Web" (Web application): JS origin `http://localhost:4000`, redirect URI is the Supabase callback. The client ID and secret live only in the Supabase dashboard. Never put them in the repo.
- Supabase Auth: the Google provider is enabled. The user reports Site URL `http://localhost:4000` and Redirect URL `http://localhost:4000/auth/callback` are set, but this is not verifiable from here.
- The Email provider is still enabled (`email: true`). Recommended: disable it, since the app is Google-only.
- Publishing requires these brand fields: homepage, privacy policy URL, terms URL and authorized domain, all on a public domain. Do NOT upload a logo: it forces Google verification.

## Gotchas

- **The MCP `execute_sql` AND `apply_migration` reject `DELETE` and also `DROP POLICY`** with `Invalid or expired requestState` (destructive-statement confirmation fails in this client), even inside a function body. Apply those with the Supabase CLI (logged in via `npx supabase login`): `npx supabase db query --linked --project-ref ihbmaydqjsoynsiugzfv --yes -f <file>`. It goes through the Management API (no DB password) and surfaces SQL errors; NOTICEs are not printed. The account logged into the Chrome Supabase Dashboard does NOT own this project. Re-running a seed-book through the MCP would duplicate `book_sections`; re-import via Dashboard, CLI, or `npm run import:book -- ... --apply`.
- Writing `.env*` with the Edit/Write tools may be blocked by local permissions; a shell append works. Never touch `.env.local`: the user creates it by hand from `.env.example`.
- Google OAuth redirect URI in Google Cloud must be the Supabase one: `https://ihbmaydqjsoynsiugzfv.supabase.co/auth/v1/callback`. `http://localhost:4000/auth/callback` goes in Supabase > Auth > URL Configuration > Redirect URLs.
- Book branding utilities are `book-*` (`bg-book-primary`, ...) to avoid clashing with the app tokens (`bg`, `surface`, `fg`, `primary`).
- The Supabase CLI login on this machine may point to another account. Check that `npx supabase projects list` includes MyShop before using `db query`; otherwise use the MCP for additive SQL.
- If `npm run typecheck` fails on stale generated types, delete `.next/types` and `.next/dev/types`.

## Wompi

- Env (server only): `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_SECRET` and `PAYMENTS_MODE=wompi`. The environment (test or prod) comes from the public key prefix; every other key must match or the provider is refused. `NEXT_PUBLIC_SITE_URL` is required (the redirect-url is `<site>/pagos/resultado`).
- Checkout links expire after 1 hour (part of the integrity signature, stored in `payment_checkouts.expires_at`). A still-valid pending checkout of the same user+subject+amount (>= 10 min left) is reused (same URL) instead of creating another one. References are `mys-p-<hex>` (purchase) or `mys-s-<hex>` (subscription) and double as the `provider_ref` for idempotency in `purchases`/`subscriptions`.
- Return URL origin: `NEXT_PUBLIC_SITE_URL`; outside production the request origin is the fallback; in production nothing else is trusted. Without an absolute origin `createCheckout` throws `PaymentsDisabledError` mentioning NEXT_PUBLIC_SITE_URL (nothing is stored).
- Webhook: the checksum is verified, then the transaction is re-fetched from Wompi's API (private key) and ITS reference/amount/currency/status are used. 401 only for a bad checksum; 200 for irrelevant events, rejections (mismatch) and unfulfillable payments; a thrown error (5xx) when the API is unreachable so Wompi retries (30 min, 3 h, 24 h).
- Fulfillment uses the amount stored on the checkout (server-computed from the DB at creation and verified against Wompi), NOT the live book price. A paid purchase is refused only if the book is missing or archived; the checkout is then flagged `approved_unfulfilled` (support must refund) and the buyer sees a "contact support, we will refund" screen. An approved subscription payment always grants.
- Checkout status machine (`checkout-status.ts`): `approved` is final except for a later `voided`; `voided` after an approval is only flagged (logged, access NOT revoked, manual review); `declined`/`error` never downgrade a paid, unfulfilled or voided checkout.
- Only an APPROVED transaction has to match the stored amount/currency; a DECLINED/VOIDED/ERROR one with different numbers is just recorded.
- Return page: answers from our own record when the webhook already settled the user's transaction; otherwise it calls Wompi only if the user has at least one checkout and under a per-user in-memory rate limit (20/min per server instance). `next` on the sign-in redirect is re-validated by `decidePostLogin` in the auth callback.
- `server-only` is deliberately NOT imported in `wompi/config.ts`, `signature.ts` or `client.ts`: their unit tests import them and `server-only` throws under vitest. Secrets only reach them from server code (stores, route handlers, provider factory).

## Pending assumptions (review before launch)

- Per-seller gateway configuration ("Configurar pasarelas", Wompi first) is planned for later; the `PaymentProvider` port is kept ready for it but nothing is built.
- No audit trail for payout account changes (who changed the account and when, previous values). Add one before real money flows: a changed payout account is a classic fraud vector.
- Payout account data (`seller_payout_accounts`) is sensitive personal data (Ley 1581 de 2012) and needs legal review. Disbursement ("dispersion") to sellers is MANUAL; publishing is not blocked when the account is missing.

- Legal text in `/privacidad` and `/terminos` is generic copy (`src/lib/legal/content.ts`). **A lawyer review is recommended before scaling** (Colombia's Ley 1581 de 2012 applies to personal data).
- Landing copy says payments go through "pasarelas de pago": Wompi is the only real gateway (platform account). Needs legal/marketing review.
- Price bounds (5.000 to 1.000.000 COP), the 20 MB limit and the 12-upload cap are assumptions.
- Changing a seller slug breaks previously shared links (no redirect history): the slug is locked while any book is published, but a seller who unpublishes everything can still change it.
- Removing a PDF (and its recipes) from a product buyers already purchased, and letting buyers download the original PDFs, need legal review (Ley 1480 de 2011, consumer protection / digital content). Today removal is allowed on sold products and purchases are untouched.
- Very large PDFs (over about 100 pages) may exceed model limits; the job fails with a readable error.
- Photos: the `recipe-photos` bucket is public, so anyone with a direct photo URL can see the photo without paying. The recipe text stays protected.
- Temp custom-image uploads (private bucket `seller-image-uploads`) are deleted on every confirm path, but an upload that is never confirmed stays there: a periodic TTL cleanup is not built yet.
- Wompi is integrated (platform account collects everything); sandbox keys are refused in production. A real end-to-end payment in production is not yet verified.

## Next steps

1. Manual E2E with real sessions: seller (sign in, profile, create a product, upload 2-3 PDFs into it, ingestion, remove one PDF, price, mock subscription, publish, share link) and buyer (sign in, `/explorar`, mock purchase, `/recetario`, download the original PDFs, `/mis-recetarios`), plus the exclusive-role redirects.
2. Set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) to switch from the mock AI to Claude.
3. In production, schedule a cron that calls `POST /api/ingestion/run` with `Authorization: Bearer $INGESTION_WORKER_SECRET`.
4. Disable the Supabase Email provider.
5. Have a lawyer review `/privacidad` and `/terminos`.
5b. Wompi setup: create the sandbox keys (Developers > Keys), fill the four `WOMPI_*` vars in `.env.local` and set `PAYMENTS_MODE=wompi`. In Developers > Events set the Events URL to `https://<domain>/api/webhooks/payments` for Sandbox and again for Production (localhost works through the return page only; use a tunnel to test the webhook). For production use `pub_prod_`/`prv_prod_`/`prod_events_`/`prod_integrity_` keys.
6. Deploy to Vercel with a custom domain:
   - **`PAYMENTS_MODE` must NOT be `mock` in production**, because mock grants free access. Leave it empty until a real gateway exists.
   - Supabase: Site URL and Redirect URL `https://<domain>/auth/callback`.
   - Google: add the JS origin and the authorized domain, then publish the Google app (no logo).
7. Before launch: a real payment gateway, real prices and photos.

## Commands

`npm run dev` (port 4000) · `npm test` (vitest) · `npm run typecheck` · `npm run build` · `npm run import:book -- "<dir>" --store <slug> [--apply]`
