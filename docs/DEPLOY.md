# Poruchka — deployment checklist

Written 2026-08-19. Every variable name below was taken from a grep of the code that reads it, not
from memory. Nothing here has been executed — this is the runbook.

---

## 0. The one architectural constraint

**`apps/api` cannot run on Vercel.** Two things in it require a long-lived process that serverless
functions cannot provide:

| What | Where | Why it needs a persistent host |
|---|---|---|
| Telegram long polling | `channels/telegram/telegram.bot.service.ts:62` — `bot.start()` | Holds an open connection waiting for updates |
| Reminder scheduler | `scheduler/scheduler.service.ts:29` — `@Cron(EVERY_MINUTE)` | In-process timer; a function that has returned cannot fire it |

So the split is:

- **`apps/web` → Vercel.** A normal Next.js 15 App Router deploy.
- **`apps/api` → a persistent container host** — Railway, Render, Fly.io or a VPS. It needs one
  always-on instance.

If you ever do want the API on serverless, it means switching Telegram to **webhooks** (the code
already anticipates this — `TELEGRAM_WEBHOOK_SECRET` and `PUBLIC_API_URL` are reserved in
`.env.example`) and moving the scheduler to an external cron hitting an endpoint. That is a real
piece of work, not a config change.

> **Run exactly one instance with `TELEGRAM_POLLING_ENABLED=true`.** Telegram rejects concurrent
> `getUpdates` for the same bot, and two schedulers would double-send reminders.

---

## 1. Vercel — project settings

The repo is a pnpm + Turborepo monorepo, so the defaults will not work.

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Root Directory | `apps/web` |
| Include files outside root directory | **On** — required; `apps/web` depends on the `@poruchka/shared` workspace package |
| Install Command | leave default (Vercel detects pnpm from `pnpm-lock.yaml`) |
| Build Command | leave default (`next build`) |
| Node version | **20 or newer** (`package.json` sets `engines.node >= 20`) |

`apps/web/next.config.mjs` already sets `transpilePackages: ["@poruchka/shared"]`, so the workspace
package compiles as part of the web build.

---

## 2. Vercel — environment variables

These four are every variable `apps/web` reads. All are `NEXT_PUBLIC_*`, meaning **they are inlined
into the browser bundle at build time** — put no secret here, and redeploy after changing any of them.

| Variable | Value | If missing |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Login is dead |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key from Supabase → Project Settings → API Keys | Login is dead. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is read as a fallback for older projects |
| `NEXT_PUBLIC_API_URL` | the public HTTPS URL of the deployed API, e.g. `https://api.poruchka.bg` | **The production build throws on first call.** This is deliberate — it previously defaulted to `http://localhost:3001`, so a deploy that forgot it shipped an admin dialling the customer's own machine |
| `NEXT_PUBLIC_SITE_URL` | the web admin's own public URL, e.g. `https://app.poruchka.bg` | `metadataBase`, `robots.ts` and `sitemap.ts` all silently fall back to `https://poruchka.bg` |

---

## 3. API host — environment variables

From `.env.example` plus a grep of `process.env` and `config.get` in `apps/api/src`:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Supabase **transaction pooler**, port 6543, with `?pgbouncer=true` |
| `DIRECT_URL` | Supabase **session pooler**, port 5432 — used by Prisma Migrate only |
| `SUPABASE_URL` | verifies web-admin JWTs via JWKS |
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `TELEGRAM_POLLING_ENABLED` | `true` on exactly one instance |
| `CORS_ORIGINS` | **see the warning below** |
| `PORT` | usually set by the host |
| `NODE_ENV` | `production` |
| `ENABLE_DEV_ENDPOINTS` | leave unset. `true` exposes unauthenticated endpoints that can bind any user's Telegram to any chat |

> ### ⚠ `CORS_ORIGINS` is fail-closed in production
>
> `main.ts:20` returns **only** the configured list when `NODE_ENV=production`. Unset, that list is
> empty and **no browser origin can call the API** — the web admin will look completely broken while
> the API itself reports healthy. It logs a warning at boot; check for it.
>
> Set it to the web admin's origin, comma-separated, no trailing slash:
> `CORS_ORIGINS=https://app.poruchka.bg`
>
> Vercel preview deployments get generated hostnames, so each preview origin you want to test
> against the real API must be added too.

`SUPABASE_SERVICE_ROLE_KEY` is deliberately **not** in this list. Nothing reads it, and it bypasses
RLS — it was removed from `.env.example` in this pass.

---

## 4. Supabase

### 4a. Apply the pending migration — do this first

One migration is on disk and not in the database:

```bash
cd apps/api && npx prisma migrate deploy
```

`20260714090000_orderrun_orderrule_restrict` changes `order_runs.orderRuleId` from
`ON DELETE CASCADE` to `ON DELETE RESTRICT`. Verified against the live database on 2026-08-19: that
FK is **still `c` (cascade)**, so **deleting an order plan today cascade-deletes its order
history** — `submittedAt`, `unitPrice`, `receivedQuantity`, `supplierReference` all go with it.

It is pure DDL. It reads, writes and deletes no rows, and is reversible by re-adding the constraint
with `CASCADE`.

**Known drift:** three migrations are recorded in `_prisma_migrations` but no longer exist in the
repo (`telegram_identity_unique`, `replace_schedules_with_orders`, `archive_order_rules`) — they were
folded into `reconcile_order_model`. `prisma migrate deploy` ignores database-only rows and will
apply just the pending one. **`prisma migrate dev` would refuse** — do not run it against production.

### 4b. Register the password-reset redirect

Supabase → **Authentication → URL Configuration → Redirect URLs**, add:

```
http://localhost:3002/reset-password
https://<your-web-domain>/reset-password
```

Without this, `resetPasswordForEmail` silently ignores `redirectTo` and the entire password-reset
flow is unreachable — the `/reset-password` page shipped in this pass never gets hit.

Set **Site URL** to the web admin origin while you are there.

---

## 5. Order of operations

1. Apply the migration (§4a) — the schema must be ahead of the code.
2. Deploy the API to its persistent host with the §3 variables. Confirm the boot log shows a
   non-empty CORS allowlist and that the Telegram bot reports polling.
3. Note the API's public URL.
4. Create the Vercel project with the §1 settings and the §2 variables, using that API URL.
5. Deploy the web admin, note its URL.
6. Go back and set `CORS_ORIGINS` on the API to the web URL, then restart the API.
7. Add both redirect URLs in Supabase (§4b).
8. Smoke test: register → confirm email → log in → add a supplier → add an item → create a plan →
   link Telegram → trigger a reminder.

Steps 3 and 6 are a deliberate loop: each side needs the other's final URL, so one restart is
unavoidable unless you assign both custom domains up front.

---

## 6. Not done yet

- **Existing users have their email address as their display name.** New sign-ups now collect a
  name, but there is no `PATCH /me { name }`, so anyone already in the database cannot be renamed.
- **No RLS policies.** Tenant isolation is enforced in the application layer only; `schema.prisma`
  is honest about this. RLS was on the open list in the July audit and still is.
- **No rate limiting or helmet** on the API.
- **`/onboarding` does not exist** — new accounts land on empty pages. `AGENTS.md` now marks it
  planned rather than describing a 404.
