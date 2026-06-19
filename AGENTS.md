# AGENTS.md — Poruchka

> A guide for AI agents and designers working on this project. Poruchka (поръчка =
> "order" in Bulgarian) is a supplier‑ordering reminder system for restaurants.

---

## 1. The problem & the product

Restaurants order supplies on a repeating, category‑by‑day rhythm (vegetables Monday,
meat Tuesday, drinks Wednesday…). Today this lives in one person's head, so orders get
missed or rushed.

**Poruchka** lets a restaurant define each good once — _item → supplier → schedule_
(e.g. *Pork Meat → Metro → every Wednesday*). On the due day the responsible person gets
a **chat message** ("order Pork Meat from Metro today") and confirms with a single tap.
If they don't, it **re‑nudges hourly** (within quiet hours) and then **escalates**.

- **Reminder channel:** Telegram for the pilot (free, instant); Viber later (commercial‑gated).
- **Management surface:** this web admin (catalog, schedules, team, notifications, calendar).
- **Honest positioning:** the reminder is the cheap wedge; paid value comes later from order
  quantities, spend analytics, and one‑tap supplier ordering. Build lean, validate on a real
  restaurant first, design multi‑tenant from day one.

---

## 2. Tech stack & architecture

Monorepo (Turborepo + pnpm). Hexagonal/ports‑and‑adapters on the backend.

| Part | Tech | Notes |
|------|------|-------|
| `apps/api` | **NestJS 11 (TypeScript)** | Domain core, scheduler, Telegram bot, REST API |
| `apps/web` | **Next.js 15 + Tailwind v4** | This web admin (auth + config pages + calendar) |
| `packages/shared` | **TypeScript + Zod** | Shared contracts (recurrence union, DTOs) |
| Database / Auth | **Supabase (Postgres + RLS + Auth)** | Prisma ORM; Supabase Auth for login |
| Reminders | **Telegram Bot API** (grammY, long polling) | Behind a `NotificationChannel` port |

**Data path:** the web admin authenticates with **Supabase Auth** (email/password), then calls
the **NestJS API** with the Supabase JWT as a Bearer token. The API verifies the token, resolves
the caller's **tenant** (restaurant), and scopes every query to it. The Telegram bot + scheduler
run server‑side in the API. Each restaurant is a tenant; isolation is enforced in the app layer
with RLS as a backstop.

---

## 3. Repository layout

```
apps/
  api/        NestJS — channels/ (port + telegram adapter), reminders/ (scheduler),
              prisma/ (schema + migrations + seed), dev/ (pilot endpoints)
  web/        Next.js — app/ (routes), components/ (UI), lib/ (supabase + api client)
packages/
  shared/     Zod schemas + types (Recurrence union, Create*Input DTOs)
```

---

## 4. Domain model (tenant‑scoped)

- **Tenant** — a restaurant. `timezone` (Europe/Sofia), `quietHoursStart/End`,
  `renudgeIntervalMin` (60), `maxNudges` (5).
- **User** — `name`, `role` (OWNER/MANAGER/STAFF), `chatChannel`, `chatUserId` (set after
  linking), `supabaseAuthId` (web‑admin login).
- **Supplier** — `name`, `contact` (e.g. Metro).
- **Item** — `name`, `supplierId`, `unit` (e.g. Pork Meat, kg).
- **Schedule** — `itemId`, `assignedUserId`, `reminderTimeOfDay`, `recurrence`, `active`.
- **ReminderInstance** — one occurrence: `dueDate`, `status`
  (PENDING/CONFIRMED/ESCALATED/CANCELLED), nudge bookkeeping. Drives the scheduler **and**
  feeds the calendar.

**Recurrence** is a discriminated union: `daily` | `weekly {weekdays:[ISO 1–7]}` |
`interval {everyNDays, anchorDate}`. Fully customizable per item.

---

## 5. Core flows

1. **Onboard** → register → create restaurant → add suppliers → add items → create schedules →
   invite team & link their Telegram.
2. **Reminder loop** → scheduler materializes today's reminders → sends Telegram message with a
   **Done** button → tap confirms (stops nudges) → unconfirmed re‑nudges hourly within quiet
   hours → escalates at the cap.
3. **Oversee** → owner watches the **order calendar**: what's due, from which supplier, who's
   responsible, and live status.

---

## 6. Page & route map

### Public (marketing / unauthenticated) — **top navbar**
| Route | Page | Key elements |
|-------|------|--------------|
| `/` | **Landing** | Hero (problem + value + CTA), how‑it‑works (3 steps), benefits, realistic Telegram‑reminder mockup, footer. Top bar: logo left, `Login` + `Register` right. |
| `/login` | **Login** | Email, password, "forgot password?" link, link to Register. |
| `/register` | **Register** | Restaurant name, email, password, **confirm password**, **"I agree to Terms & Privacy"** checkbox. |
| `/forgot-password` | **Forgot password** | Email → sends reset link. |
| `/reset-password` | **Reset password** | New password + confirm (from email link). |
| `/terms`, `/privacy` | **Legal** | Required for the registration agreement checkbox. |

### App (authenticated) — **left sidebar shell**
| Route | Page | Key elements |
|-------|------|--------------|
| `/onboarding` | **Onboarding** (first run) | Name your restaurant, set timezone — only if no tenant yet. |
| `/dashboard` | **Calendar** (home) | Month/week order calendar; each day shows due items, supplier, assignee, status (pending/confirmed/escalated). |
| `/suppliers` | **Suppliers** | Table + create/edit/delete (e.g. Metro). |
| `/items` | **Items / Menu** | Table + create/edit/delete; choose supplier + unit. |
| `/schedules` | **Schedules** | Table + create/edit; choose item, responsible person, **recurrence picker** (daily / weekly weekday‑picker / every‑N‑days), time of day. |
| `/team` | **Team** | List people; add staff; **"Connect Telegram"** (shows deep link / QR); remove. |
| `/settings` | **Notifications** | Quiet hours, re‑nudge interval, max nudges, timezone. |
| `/profile` | **Profile / Account** | Name, email, password change, sign out. |

**Logout** is a button in the sidebar footer (not a page). **Sign out** also available on Profile.

---

## 7. Navigation model (decided)

- **Public pages** use a **top horizontal navbar**: logo left; `Login` (text) + `Register`
  (solid primary button) right. **No left sidebar on marketing pages.**
- **App pages** use a **persistent left sidebar** (Calendar, Suppliers, Items, Schedules, Team,
  Notifications, Profile) with the signed‑in email + Sign out in the footer.
- **Mobile:**
  - App sidebar is **hidden by default and opens via a ☰ (hamburger)** as a slide‑in drawer
    with a dimmed backdrop; closes on navigation or backdrop tap.
  - Public top bar keeps `Register` visible (it's the primary CTA); any secondary links collapse
    into a ☰ menu.
- Breakpoints: sidebar drawer below `lg` (1024px); top‑bar collapse below `md` (768px).

---

## 8. Design direction (IMPORTANT — avoid the "AI‑generated" look)

The owner explicitly wants this to **not** look AI‑generated. Hard rules:

**Avoid**
- ❌ Emoji as icons (our current sidebar uses 📅🏪🥩 — replace them).
- ❌ Generic out‑of‑the‑box icon dumps; decorative icons on every heading.
- ❌ Purple/indigo "AI" gradients, glassmorphism, floating gradient "blobs/bubbles".
- ❌ Stock 3D illustrations, lorem ipsum, everything pill‑rounded, heavy drop shadows.

**Prefer**
- ✅ One restrained, confident palette with a **single accent** (suggest a warm, food‑adjacent
  tone — deep green or amber/terracotta — on a near‑neutral base; **move away from the default
  indigo** currently in the code). Pick one accent and use it intentionally.
- ✅ Real copy with concrete Bulgarian‑restaurant examples (Metro, Pork Meat, Wednesdays) — not
  placeholder text.
- ✅ A **realistic Telegram‑message mockup** as the hero visual (chat bubble: "🛒 Order Pork Meat
  from Metro today" + a **Done** button) — it *shows* the product instead of decorating.
- ✅ Crisp 1px borders, generous whitespace, strong type hierarchy, restrained radii (8–12px).
- ✅ Icons: a single line‑icon set used **sparingly** — **Lucide** (`lucide-react`) is the
  recommended choice (clean, professional, not "AI"). Suggested mapping for the sidebar:
  Calendar→`CalendarDays`, Suppliers→`Store`, Items→`Package`, Schedules→`Repeat`,
  Team→`Users`, Notifications→`Bell`, Profile→`User`. Or go icon‑light/text‑only.
- ✅ Distinct typography (e.g. a characterful display face for headings + a clean sans for body)
  to avoid the default‑Inter‑everywhere feel.

**Component states to design (not just the happy path):** loading, empty ("No suppliers yet —
add your first"), error, disabled, and confirmation dialogs for destructive actions.

---

## 9. Auth specifics

- **Provider:** Supabase Auth, email + password.
- **Register fields:** restaurant name, email, password, confirm password, agree‑to‑terms
  checkbox. Validate password match client‑side; show inline errors.
- **Email confirmation:** if enabled in Supabase, after signup show "check your email"; user
  confirms, then logs in.
- **First login → onboarding:** the API auto‑provisions a Tenant + OWNER User on first
  authenticated call if none exists; `/onboarding` lets them name the restaurant + set timezone.
- **Forgot/Reset:** standard Supabase reset‑email flow.

---

## 10. Dev commands & ports

```bash
# from repo root (pnpm; Windows: pnpm bin is under %APPDATA%\npm)
pnpm install
pnpm --filter @poruchka/api dev      # NestJS API + Telegram bot  -> http://localhost:3001
pnpm --filter @poruchka/web dev      # Next.js web admin          -> http://localhost:3002
pnpm --filter @poruchka/api db:seed  # idempotent pilot seed
```

- **Web admin runs on port 3002** (port 3000 is used by another local app).
- Secrets live in gitignored env files (`apps/api/.env`, `apps/web/.env.local`); **never** commit
  real keys — `.env.example` holds placeholders only. The web app needs
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public), `NEXT_PUBLIC_API_URL`.

---

## 11. Conventions

- TypeScript everywhere; shared contracts/DTOs in `packages/shared` (Zod). Reuse them on both
  ends rather than redefining types.
- Timezone‑correct date math (luxon/date‑fns‑tz) — never assume the server timezone.
- New messaging channels = new adapter behind `NotificationChannel`; don't touch domain logic.
- Keep secrets out of git; everything tenant‑scoped.
- Match the surrounding code's style; small, surgical changes.

---

## 12. Current status (as of this writing)

- ✅ Monorepo, domain schema, live Supabase migration + seed.
- ✅ Telegram adapter (linking + Done‑button confirm), bot verified polling live.
- ✅ Web foundation: login/register + sidebar shell (compiles; runs on :3002).
- ⏳ Next: real CRUD pages + backing API endpoints, order calendar, scheduler nudge loop,
  and the **design pass** this document is meant to drive.
