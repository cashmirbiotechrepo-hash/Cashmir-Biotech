# Cashmir Biotech — Admin Platform Build Plan

> **How to use this file:** This is written to be handed to Claude Code / Cursor as the source of truth. It is deliberately *not* the "build 180 modules" version. It cuts the two source proposals down to something a small team can actually ship, phase by phase, with real schema, routing, auth, and UI decisions instead of noun-lists. Build strictly in phase order. Do not start Phase 2 modules until Phase 1 is in production and used daily.

---

## 0. Reality check on the source plans

The two drafts this replaces (an "18-module Biotech OS" and a "22-module Enterprise OS with 250–400 tables") were both LLM-generated wishlists. They're useful as an *inventory of ideas*, but dangerous as a build order, for these reasons:

- **No prioritization.** Commerce, LIMS, ELN, bioinformatics compute, patents, student LMS, CRM, finance, and a Kubernetes-scale ops stack were all presented as day-one work — far more than a small team should take on at once for one storefront and one product line.
- **Nouns, not schema.** "250–400 normalized tables" was asserted, never designed. Long bullet lists ("Categories, Subcategories, Brands, Manufacturers, Collections, Tags...") describe *entities*, not a data model — there's no indication of what's actually a table vs. a field vs. a filter.
- **No API or auth architecture** was specified at all — just section names.
- **Automation diagrams have no failure path.** Every workflow shown is the happy path only; nothing about retries, idempotency, or what happens when an external API times out.
- **"AI Insights" bullets are unimplementable as written.** ("Predicts stock-out in 6 days") — no model, no data source, no pipeline. There's no budget or need for an AI/ML layer here anyway — every one of these numbers is a plain formula over data you already have. See §6a for the actual math.
- **Security was listed as a checklist** (WAF, SIEM, ABAC, passkeys, DDoS protection) rather than prioritized against actual risk. Your own attendance-system review turned up basic bugs (OTP returned in API responses, auth enforced client-side) — that class of bug is fixed by discipline and code review, not by bolting on enterprise security products.
- **Likely duplicate scope**: the "Bioinformatics" module in both drafts (BLAST, MSA, phylogenetics, GPU job queue) overlaps heavily with the separate ~300-tool bioinformatics suite already being built. Decide explicitly whether this admin panel *links to* that suite (recommended) or reimplements it (do not do this — massive duplicated effort).

This document keeps the good ideas (domain-based organization, automation-first thinking, treating bioinformatics as infra) and throws out the parts that don't survive contact with an actual build — including replacing every "AI Insights" idea with plain inventory-math formulas that need no AI budget at all (§6a).

---

## 1. Phasing — build in this order, nothing out of order

### Phase 1 — MVP (ship this first)
Goal: a working store + content admin that a non-technical person can run the business from.

- Auth (admin login, roles: `owner`, `staff`)
- Products (single unified model — see §3)
- Orders (create on checkout, view, update status, refund)
- Inventory (single stock number per SKU, formula-driven low-stock/reorder flag — see §6a)
- Basic Content (edit homepage sections, blog posts)
- Media library (one shared file/image system, reused everywhere)
- Dashboard (5–8 real numbers pulled from real tables, not 30 placeholder cards)
- Notification: email only (order confirmation, low stock alert to admin)

### Phase 2 — Operational depth (after Phase 1 is live and used weekly)
- Patents module (you already have real patent data — this is genuinely differentiating, build it next)
- CRM (contacts, companies, simple deal pipeline — not a full Salesforce clone)
- Marketing basics (coupon codes, simple email campaign sends)
- Finance basics (GST-compliant invoice generation, expense log)
- Role refinement (add `researcher`, `support` roles if actually needed)

### Phase 3 — Lab / research (only once there's a live wet lab or research team using it)
- LIMS-lite: samples, experiments, equipment bookings — start with the 20% of Benchling that gets used 80% of the time (a notebook + sample tracker), not a full ELN
- Link out to the bioinformatics suite via API rather than rebuilding it here

### Phase 4 — Student/education portal (only if enrollment is actually happening)
- Students, attendance, grades — reuse the auth/role system, don't build a parallel one

### Explicitly out of scope
Kubernetes, Elasticsearch, dedicated SIEM, ABAC (RBAC is enough for a team this size), Prometheus/Grafana/Loki/OpenTelemetry stack, any "AI Center" / AI-generated copy or predictions (no budget for an AI API layer, and every one of those "insights" is actually just a formula over data you already have — see §6a), a workflow-builder UI (write automations in code, not a no-code builder, until you have >20 of them), multi-warehouse/RFID inventory, manufacturing MRP.

**Rule of thumb:** if a module doesn't have a named person who needs it right now, it's not Phase 1 or 2.

---

## 2. Tech stack (trimmed)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router), TypeScript | matches existing site |
| UI | Tailwind + shadcn/ui | fast, consistent, accessible defaults |
| DB | PostgreSQL + Prisma | relational data fits this domain well |
| Auth | Auth.js (NextAuth) with credentials + optional TOTP | don't build custom OTP/session logic — that's what broke in the attendance system |
| API | Next.js Route Handlers + Zod validation | no need for tRPC/GraphQL at this scale |
| File storage | Cloudflare R2 or S3, signed upload URLs | never accept raw uploads to your own server |
| Email | Resend | simplest for transactional email |
| Payments | Razorpay (or Stripe if international) | pick one first, add the second later |
| Background jobs | Start with Vercel Cron / simple queue table; add BullMQ+Redis only once job volume actually needs it | don't provision Redis for a job that runs twice a day |
| Monitoring | Sentry (errors) + Vercel Analytics | skip the full observability stack until Phase 3+ |

Everything else in the original stack tables (Kubernetes, Elasticsearch, Prometheus/Grafana/Loki, dedicated SIEM) is Phase 4+ or "never, at this scale" — revisit only if you have measured a real bottleneck.

---

## 3. Data model — concrete, not a noun list

Design principle: **one flexible table beats five rigid ones.** Where the source docs wanted separate menus for Categories/Subcategories/Brands/Collections/Tags, use a generic taxonomy pattern instead.

### Core entities (Phase 1)

```
User            id, email, passwordHash, role, name, createdAt
Session         (managed by Auth.js)

Product         id, slug, name, description, status(draft|active|archived),
                 priceCents, compareAtPriceCents, sku, stockQty, lowStockThreshold,
                 patentId (nullable, FK -> Patent, added in Phase 2),
                 metaTitle, metaDescription, createdAt, updatedAt
ProductImage    id, productId, url, altText, position
ProductVariant  id, productId, name, sku, priceCents, stockQty   -- only if variants are actually needed

Taxonomy        id, type(category|tag|collection), name, slug     -- ONE table, not five
ProductTaxonomy join table: productId, taxonomyId

Order           id, orderNumber, userId(nullable, guest allowed), status,
                 subtotalCents, taxCents, shippingCents, totalCents,
                 shippingAddress(json), createdAt
OrderItem       id, orderId, productId, quantity, unitPriceCents
Payment         id, orderId, provider, providerRef, status, amountCents, createdAt
Refund          id, orderId, amountCents, reason, status, createdAt

MediaAsset      id, url, type, altText, uploadedById, createdAt   -- ONE shared library,
                                                                     referenced by products, blog, patents, everything

Page            id, slug, title, blocks(json), status, updatedAt  -- content-managed pages
BlogPost        id, slug, title, body(markdown), status, publishedAt

AuditLog        id, userId, action, entityType, entityId, diff(json), createdAt
```

### Why a generic `Taxonomy` table instead of separate Category/Brand/Collection/Tag tables
The original plans had you building five near-identical CRUD admin screens (list, create, edit, delete, reorder) for things that are structurally the same: a named thing with a slug that products get tagged with. One table + one admin screen with a `type` filter replaces five. Add a real separate table later **only** if a taxonomy type grows genuinely different behavior (e.g., Brands eventually need a logo + description + own landing page — fine, promote it to its own table then, not preemptively).

### Phase 2 additions
```
Patent          id, title, applicationNumber, status(pending|granted|expired),
                 country, filedAt, grantedAt, inventors(json), documentAssetId,
                 linkedProductIds(json or join table), createdAt

Contact         id, name, email, company, phone, type(lead|customer|partner), notes
Deal            id, contactId, title, stage, valueCents, expectedCloseAt

Coupon          id, code, type(percent|fixed), value, expiresAt, maxUses, usedCount
Invoice         id, orderId, gstDetails(json), pdfAssetId, issuedAt
```

Don't design Phase 3/4 tables yet — you'll design them wrong before you've seen how Phase 1/2 data actually gets used. Revisit this file and extend it when you get there.

---

## 4. API design

- REST-style route handlers under `/api/admin/*` for admin actions, `/api/*` for public/storefront.
- Every mutating route: Zod-validate the body, check the session role **on the server**, then act. Never trust a role sent from the client (this was the exact class of bug found in the attendance system).
- Response shape, consistently:
  ```ts
  // success
  { data: T }
  // error
  { error: { code: string, message: string } }
  ```
- Pagination: cursor-based (`?cursor=...&limit=20`) for anything that can grow unbounded (orders, products, audit log). Offset pagination is fine for small fixed lists.
- Idempotency: any route triggered by a webhook (payment success, courier status) must be idempotent — store the provider's event ID and no-op on replay. This is the single most common cause of duplicate-order bugs.

### Route map (Phase 1)
```
/api/admin/products          GET (list), POST (create)
/api/admin/products/[id]     GET, PATCH, DELETE
/api/admin/orders            GET
/api/admin/orders/[id]       GET, PATCH (status update)
/api/admin/orders/[id]/refund  POST
/api/webhooks/payment        POST  (signature-verified, idempotent)
/api/webhooks/shipping       POST  (signature-verified, idempotent)
/api/admin/media             POST (get signed upload URL), GET (list)
/api/admin/pages/[slug]      GET, PATCH
```

---

## 5. Auth & roles

Keep it boring on purpose:

- **Sessions via Auth.js**, httpOnly cookies. No custom JWT handling unless you have a specific cross-service need.
- **Roles, Phase 1**: `owner`, `staff`. That's it. Add `researcher`, `support`, `finance` in Phase 2/3 only when a real person needs a narrower view.
- **Enforcement point**: Next.js middleware checks "is this an authenticated admin session" for anything under `/admin/*`. Individual route handlers additionally check role for specific actions (e.g., only `owner` can issue refunds). Do this check **inside the route handler**, never rely on the UI hiding a button as the only protection — that was a real bug in a previous project (role-switcher panel left enabled in production).
- **2FA**: TOTP via Auth.js, required for `owner` role, optional for `staff`. Don't build passkeys/WebAuthn until you have actual account-takeover pressure to justify it.
- **Audit log**: every admin mutation writes one `AuditLog` row (who, what, when, before/after diff). This one thing catches most "who changed this price" arguments before they start — build it in Phase 1, not later.

---

## 6. Automation — the real version

The source docs drew nice arrow diagrams with no failure handling. Here's the same order-flow, but implementable:

```
Payment webhook received
  → verify signature
  → check event ID not already processed (idempotency)
  → if payment succeeded:
      → mark Order.status = 'paid'         (single DB transaction)
      → decrement Product.stockQty
      → enqueue: send confirmation email    (retry 3x, then alert admin)
      → enqueue: generate invoice PDF        (retry 3x, then alert admin)
  → if payment failed:
      → mark Order.status = 'payment_failed'
      → enqueue: send "payment failed" email
```

Rules for every automation you build:
1. The core state change (order marked paid, stock decremented) happens in **one DB transaction**, synchronously, in the webhook handler. Don't make the "did we actually get paid" fact depend on a background job succeeding.
2. Side effects (email, PDF, SMS) are **queued and retried independently** — if the email provider is down, that should never roll back the order.
3. Every automation has an explicit failure path: after N retries, write to an `AutomationFailure` log and notify a human. "Notify admin" is not optional — silent failures are how orders get lost.
4. Start with a simple `pg`-backed job table (`id, type, payload, status, attempts, runAt`) processed by a cron-triggered route. Move to BullMQ+Redis only when job volume genuinely needs sub-second latency or high throughput.

---

## 6a. Stock alerts & demand signals — formulas, not AI

Both source drafts wanted an "AI" layer to flag low stock and predict demand. That needs no model, no API budget, and no external service — it's a handful of well-known inventory formulas run over your own `Order`/`OrderItem` data on a daily cron. This is what actually powers "days until stock-out" and "reorder now" style numbers in real e-commerce/inventory systems.

**1. Average daily sales (ADS)** — trailing window, e.g. 14 days:
```
ADS = (units sold in last 14 days) / 14
```

**2. Days until stock-out**
```
DaysLeft = currentStockQty / ADS
```
Flag "low stock" when `DaysLeft <= leadTimeDays + bufferDays` (lead time = how long it takes to restock; buffer = a few days of margin you choose per product).

**3. Reorder point (ROP)** — the standard formula, tells you the stock level at which to reorder:
```
ROP = (ADS × LeadTimeDays) + SafetyStock
```

**4. Safety stock** — covers demand/lead-time variability, using the max/average method (simple, no statistics library needed):
```
SafetyStock = (MaxDailySales × MaxLeadTimeDays) − (ADS × AvgLeadTimeDays)
```
If you want it slightly more rigorous later, the standard-deviation version is:
```
SafetyStock = Z × σ_demand × √(LeadTimeDays)
```
where `σ_demand` is the standard deviation of daily sales over the trailing window and `Z` is a service-level constant (e.g. `Z = 1.65` for ~95% service level). Not needed for Phase 1 — the max/average formula above is good enough until you have months of clean sales history to compute a meaningful standard deviation from.

**5. Simple demand trend** — is a product speeding up or slowing down — compare two trailing windows instead of any forecasting model:
```
Trend = (ADS_last_7_days − ADS_previous_7_days) / ADS_previous_7_days
```
Show this as a plain "+18% vs last week" / "−9% vs last week" stat, computed directly, not framed as a prediction.

**Implementation**: one scheduled route (daily cron) that, per product, pulls trailing `OrderItem` quantities, computes ADS/DaysLeft/ROP with plain SQL or a Prisma aggregate query, and writes the result onto the product row (or a small `StockSignal` table: `productId, ads, daysLeft, reorderPoint, computedAt`). The dashboard just reads that precomputed table — no live heavy computation on page load, no black box.

---

## 7. UI — pitfalls to avoid, and the fix

This is the part both source docs skipped almost entirely, and it's exactly where your marketing site had real problems (blank stub pages, no mobile nav, accessibility gaps). Checklist to actively guard against when Claude Code/Cursor builds screens:

| Common failure when a code-gen tool scaffolds admin screens | Fix to apply everywhere |
|---|---|
| Every list page ships with data only — no empty state | Every table/list gets an explicit empty state with one clear action ("No products yet — Add your first product") |
| No loading state; page flashes blank then populates | Skeleton loaders matching the final layout, not a generic spinner |
| Errors shown as raw `"Error: undefined"` or a silent console.log | Every failed request shows a real message ("Couldn't save — check your connection and try again") with a retry action |
| Forms with no validation feedback until submit | Inline validation on blur, submit button disabled with a reason, not just greyed out silently |
| Dashboards with 20–30 KPI cards and no hierarchy | Max 6–8 numbers above the fold, grouped by what a person actually checks daily; everything else lives one click away |
| Sidebar nav that doesn't collapse on mobile (this exact bug already happened on your marketing site) | Test every admin screen at 375px width before calling it done; sidebar becomes a drawer below ~768px |
| Destructive actions (delete product, issue refund) with no confirmation | Every destructive action gets a confirm step that names the specific thing being affected ("Delete 'Psyllium Husk 500g'? This can't be undone.") |
| Tables that don't handle 0, 1, and 10,000 rows differently | Design for the empty state, the single-row state, and pagination from day one — not just the demo-data-of-12 state |
| Buttons whose label doesn't match the resulting toast/message | "Publish" → toast says "Published," not "Success" — keep the verb consistent through the whole flow |
| Color/contrast and focus states skipped because "it's just internal tooling" | Internal tools still need visible keyboard focus and real contrast — staff will use this 8 hours a day |
| Dashboard shows a vague "prediction" or trend arrow with nothing computable behind it | Every number on the dashboard must trace back to a real query or formula (see §6a) — a fake number erodes trust in every real number next to it |
| Generic, unstyled default component look with no relationship to the brand | Reuse the type scale, spacing, and accent color from the existing marketing site so the admin panel doesn't feel like a different, cheaper product |

Practical build order for UI: build the shared layout (sidebar + topbar + auth gate) once, get it right on mobile and desktop, then every new module is just a table + a form dropped into that shell. Don't let each module invent its own layout.

---

## 8. Security baseline (Phase 1, not the full checklist)

Do these, in this order, before anything fancier:

1. All role checks enforced server-side, in the route handler, every time (never client-only).
2. Passwords via Argon2id (Auth.js default is fine). Never log or return password hashes, OTPs, or tokens in any API response — this exact bug (OTP returned in the API response) was already found once; write a lint rule or code-review checklist item for it.
3. Zod-validate every input at the API boundary. Never trust body/query data directly into a Prisma query.
4. Signed, time-limited URLs for all file uploads and downloads; never accept a raw multipart upload straight to a public path.
5. Rate-limit login and any public-facing mutating endpoint (checkout, contact forms) — a simple in-memory or DB-backed limiter is enough at this scale.
6. HTTPS everywhere (handled by hosting), CSRF protection from Auth.js defaults, strict CORS on the API.
7. Automated daily DB backups with a tested restore — test the restore once, don't just assume the backup job "probably works."
8. Audit log (see §5) as your primary "what happened" tool instead of a SIEM.

Everything past this (WAF, DDoS protection, ABAC, dedicated secrets manager, bot detection) is real and worth doing — once you have paying customers and real traffic to justify it. Doing it now is effort spent on a threat model you don't have yet, instead of on shipping.

---

## 9. What to tell Claude Code / Cursor, concretely

When you hand this off, work module by module, in Phase 1 order from §1, and for each module:
1. Add the Prisma models from §3 (only that module's models, don't pre-create Phase 3/4 tables).
2. Build the route handlers from §4's pattern (Zod validation, server-side role check, consistent response shape).
3. Build the UI using the shared layout shell, applying every row in the §7 checklist.
4. Wire any automation per §6 (transactional core change + queued side effects + failure logging), and any stock/demand numbers per §6a's formulas (never an AI call).
5. Only after a module is working end-to-end and you've used it for real, move to the next one.

Don't ask it to scaffold all 18–22 modules from the original drafts at once — that's exactly how you end up with 40 blank stub pages, which is the same failure your marketing site already had.
