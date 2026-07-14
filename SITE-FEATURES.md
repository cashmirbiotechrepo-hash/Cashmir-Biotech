# Cashmir Biotech — Site Features & Options

> This document records **what the website did** — its pages, features, content
> options, data, and backend capabilities — so the frontend can be rebuilt from
> scratch. It intentionally says **nothing about how anything looked** (no
> colors, fonts, layout, spacing, or animation). Visual design is out of scope
> here and starts fresh.

The backend (database, auth, API, content services, validation, middleware)
was preserved during the frontend wipe. Everything below describes behavior and
data, not presentation.

---

## 1. What the site is

Cashmir Biotech is an institutional-facing marketing website plus a small
built-in CMS. It presents a biotech / nutraceutical company's products,
patents, and leadership, and lets an admin edit that content without touching
code. It is **not** an e-commerce store — there is no cart, checkout, or public
account system.

- Company: Cashmir Biotech Pvt Ltd
- Contact: contact@cashmirbiotech.com
- Location: Kashmir, India
- Site URL (default): https://cashmirbiotech.com

---

## 2. Pages & routes

### Public routes
| Route | Purpose | Data source |
|-------|---------|-------------|
| `/` | Homepage | `SiteSettings` + featured `Product`s + latest `Patent`s |
| `/products` | Full product catalog | all active `Product`s |
| `/patents` | Patent & research registry | all `Patent`s |
| `/team` | Board / leadership listing | all `TeamMember`s |

Public content pages (`/`, `/products`, `/patents`, `/team`) are statically
rendered with **ISR** (`revalidate = 3600`) and a try/catch fallback, so they
stay fast and cache-friendly while CMS edits appear within the revalidation
window (admin saves also trigger an immediate `revalidatePath`). The admin
dashboard is `force-dynamic` because it is session-bound.

### Admin routes
| Route | Purpose | Access |
|-------|---------|--------|
| `/admin` | Entry redirect — sends to dashboard if logged in, else login | public |
| `/admin/login` | Email + password sign-in | public (rate-limited) |
| `/admin/dashboard` | Content management console | protected (JWT session) |

### System routes
| Route | Purpose |
|-------|---------|
| `/api/newsletter` | POST endpoint to capture newsletter subscribers |
| `/robots.txt` | Generated robots file |
| `/sitemap.xml` | Generated sitemap |
| `not-found` (404) | Fallback for unknown routes |
| `error` / `loading` | Styled per-group error + loading boundaries (public + admin). Errors log to the console and release any loader scroll-lock; offer retry + a way back. |

### Public navigation options
The floating header persists across all public routes (it survives client-side
navigation) and exposes:
- Catalog → `/products`
- Patents → `/patents`
- Board → `/team`
- Contact CTA → `mailto:contact@cashmirbiotech.com`
- Wordmark → `/` (home)

The active route is indicated in the nav. On mobile (`< md`) the links collapse
into a **hamburger drawer** that also surfaces the Contact CTA and an **Admin
console** link (`/admin/login`). A **skip-to-content** link is the first
focusable element for keyboard/screen-reader users. Hero CTAs use the
CMS-editable `ctaPrimaryHref` / `ctaSecondaryHref` (default `/products` and
`/patents`).

---

## 3. Homepage content options

The homepage pulls editable fields from the `SiteSettings` record and lists of
products/patents. Content blocks that existed:

**Hero (all fields CMS-editable):**
- `heroSubtitle` — short eyebrow line
- `heroTitle` — main headline
- `heroDescription` — supporting paragraph
- Primary CTA: `ctaPrimaryText` + `ctaPrimaryHref` (default "Explore Catalog" → `/products`)
- Secondary CTA: `ctaSecondaryText` + `ctaSecondaryHref` (default "View Patents" → `/patents`)

**Other homepage blocks (content, not layout):**
- Credentials list (standards the company aligns to): GMP discipline, LC-MS verification, Kashmir biodiversity origin, SKUAST-K partnership, batch records, patent filings
- Rotating standards labels: SKUAST-K aligned, LC-MS verification, GMP discipline, phyto-active extracts, Kashmir origin, batch traceability, patent registry, clinical labeling
- Manufacturing pipeline — 4 stages:
  1. Alpine source selection
  2. Cold-chain phyto isolation
  3. Independent assay (LC-MS)
  4. Clinical-ready nutrition
- Institutional proof stats: purity protocols (99.7%), research partners (1 — SKUAST-K), patent filings (10+)
- Featured products (up to 3, prioritizing `featured`)
- Patents preview (up to 3 latest)
- FAQ (3 Q&A entries)
- Newsletter signup (posts to `/api/newsletter`)
- Mission statement (`missionStatement` field)

**Footer content options:**
- Formulations: Product catalog, Institutional inquiry (mailto)
- Science: Patent registry, Research archive
- Company: Home, Board members, Admin console
- Credentials line: SKUAST-K · GMP · LC-MS
- Copyright with current year

---

## 4. Products

Each product exposes these fields (all editable in admin except system fields):

| Field | Type | Notes |
|-------|------|-------|
| `slug` | string | unique, URL-safe identifier |
| `name` | string | |
| `shortBenefit` | string | one-line benefit |
| `description` | string | long description |
| `mrpInr` | int | price in INR |
| `sizeLabel` | string | e.g. "80g", "200 count" |
| `category` | string | e.g. Functional Food, Supplement |
| `imageUrl` | string | image location (CDN or path) |
| `featured` | boolean | promotes to homepage |
| `active` | boolean | controls public visibility |
| `createdAt` / `updatedAt` | datetime | system |

Catalog page lists all **active** products, newest first. Homepage shows
featured-first, up to 3.

**Seed products:**
1. Magic Food TaxO — Functional Food, 80g, ₹350, "Promotes prostate health", featured. Flagship functional food containing the TaxO molecule from underutilized Kashmiri plants.
2. Iron Revive Herbal — Supplement, 200 count, ₹500, "Herbal iron supplement". Daily iron support engineered for high absorption and gentle digestion.

---

## 5. Patents

| Field | Type | Notes |
|-------|------|-------|
| `patentCode` | string | unique code |
| `title` | string | |
| `summary` | string | |
| `status` | string | e.g. Granted, Pending |
| `jurisdiction` | string | e.g. India |
| `publishedAt` | datetime | |
| `createdAt` / `updatedAt` | datetime | system |

Registry lists all patents, newest published first.

**Seed patent:** IN-CBT-2024-001 — "TaxO Enriched Functional Food Composition",
Granted, India, published 2024-05-10. Composition and extraction protocol for
anti-cancer functional foods from Kashmiri flora.

---

## 6. Team / Board

| Field | Type | Notes |
|-------|------|-------|
| `fullName` | string | |
| `role` | string | |
| `bio` | string | |
| `avatarUrl` | string | |
| `sortOrder` | int | controls list order |
| `createdAt` / `updatedAt` | datetime | system |

Team page lists members by ascending `sortOrder`.

**Seed team:**
1. Dr. Khalid Zaffar Masoodi — Director and Founder. Associate Professor and Senior Scientist, leads scientific direction and product innovation.
2. Aqib Ahmad Hurra — Director. Co-founder driving strategic operations and the faculty-student innovation model.

---

## 7. Admin console capabilities

Reachable at `/admin/dashboard` after login. A sticky top bar shows the signed-in
admin email and a **Sign out** button. Content is organized into four tabs:

- **Homepage** — single form to edit hero title, subtitle, description, mission statement, and both CTA text/link pairs.
- **Products** — one collapsible form per product: name, short benefit, description, price (INR), size label, and image URL.
- **Patents** — one collapsible form per patent: title, summary, and status.
- **Board** — one collapsible form per member: full name, role, bio, and avatar URL.

Behaviors:
- Every save is a Next.js **server action** guarded by an active admin session (`requireAdminSession`) and validated server-side with Zod (see §9).
- Feedback is **inline** per form — a green confirmation on success or a red message on validation/DB error (no full-page reload). Successful saves call `revalidatePath` on the affected public route(s).
- Sign-out is a server action that clears the session cookie and redirects to login.

> Note: the current CMS supports **editing** existing records (and upserting the
> single homepage settings row). Creating/deleting products, patents, or team
> members was done via the seed script / database, not the UI.

---

## 8. Authentication & security

- Single-admin auth using **email + bcrypt password hash** stored in env (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`).
- Session is a **JWT** (HS256, signed with `JWT_SECRET`, issuer/audience checked, 2-day expiry) stored in an **httpOnly** cookie (`secure` in production, `sameSite=lax`).
- Password comparison always runs bcrypt (constant-ish timing) so response time doesn't reveal whether the email matched.
- Middleware protects `/admin/dashboard*` — no/invalid token redirects to login with a `next` return path.
- Login redirect target is sanitized (must be a same-site path).
- Admin pages are marked `robots: noindex, nofollow`.

### Rate limiting (edge middleware, optional)
- `/api/newsletter` POST and `/admin/login` POST are rate-limited per client IP.
- Uses Upstash rate-limit if configured; degrades gracefully (no limit) if not.

---

## 9. Validation rules (server-side, Zod)

- **Homepage settings:** heroTitle (1–500), heroSubtitle (≤500), heroDescription (1–20000), CTA texts (1–200), CTA hrefs must be site-relative or http(s) (≤2000, blocks `javascript:`/`data:`), missionStatement (1–20000).
- **Product update:** name/shortBenefit (1–500), description (≤50000), mrpInr (int 0–100,000,000), sizeLabel (1–200), imageUrl safe-URL.
- **Patent update:** title (1–1000), summary (≤50000), status (1–200).
- **Team update:** fullName/role (1–200), bio (≤50000), avatarUrl safe-URL.
- **Newsletter:** valid email, ≤320 chars, lowercased and de-duplicated (idempotent upsert; does not reveal if already subscribed).
- **Admin login:** valid email (≤320) + non-empty password (≤200); on success mints the JWT session cookie and redirects to the sanitized `next` path (default `/admin/dashboard`).

---

## 10. Data models (Prisma / PostgreSQL)

- **SiteSettings** — singleton (id=1): companyName, heroTitle, heroSubtitle, heroDescription, ctaPrimaryText/Href, ctaSecondaryText/Href, missionStatement, updatedAt.
- **Product** — see §4.
- **Patent** — see §5.
- **TeamMember** — see §6.
- **Subscriber** — email (unique), source (default "homepage"), createdAt.

---

## 11. Public API

- `POST /api/newsletter`
  - Body: `{ "email": string }`
  - `200 { ok: true }` on success (idempotent)
  - `400` invalid JSON, `422` invalid email, `429` rate limited, `500` storage error

---

## 12. Backend/tech notes (preserved)

- Next.js App Router + TypeScript.
- Prisma ORM against PostgreSQL (`DATABASE_URL`).
- Structured logging via pino (`logger`).
- Server-only content service (`src/modules/cms/services/content.service.ts`) with read helpers (`getPublicHomeContent`, `listActiveProducts`, `listPatents`, `listTeamMembers`, `getDashboardContent`) and write helpers (`upsertHomepageContent`, `updateProductContent`, `updatePatentContent`, `updateTeamMemberContent`).
- Auth helpers in `src/lib/auth.ts` (Node) and `src/lib/auth-edge.ts` (edge/middleware).
- Env is validated in `src/config/env.server.ts`; auth constants in `src/config/auth.constants.ts`.
- SEO: metadata in root layout, generated `robots.ts` and `sitemap.ts`.

---

## 13. Environment variables

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — session signing secret
- `ADMIN_EMAIL` — admin login email
- `ADMIN_PASSWORD_HASH` — bcrypt hash of admin password
- `NEXT_PUBLIC_SITE_URL` — canonical site URL (optional; defaults to production URL)
- Upstash Redis vars — optional, enable rate limiting when present

See `.env.example` for the full list.
