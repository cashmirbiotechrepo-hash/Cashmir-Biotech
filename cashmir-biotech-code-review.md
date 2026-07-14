# Cashmir Biotech — Code Review Report

> **Status (2026-07-14):** Critical/High items #1–#7, #8, #10–#12 addressed in codebase, plus partial #9/#15/#16.
> Remaining polish: #13 CSP nonces, #14 WAF regex, full campaign queue for #9.

**Scope:** `admin-logic-api-bundle.txt` (132 files — Next.js app, admin console, API routes, Prisma schema)
**Reviewed:** Auth/session/2FA, PoW anti-bruteforce, payments (Razorpay), inventory/order logic, CSV exports, admin server actions, RBAC, middleware, dashboard/reporting services.
**Method:** Full manual read-through of every security-relevant file plus a targeted pass over all admin server actions, checkout/payment flow, and inventory reservation logic. Findings below are things I could point to a specific line/behavior for — not general style opinions.

Legend: 🔴 Critical 🟠 High 🟡 Medium 🔵 Low / Polish

---

## 🔴 Critical

### 1. Login proof-of-work (PoW) can be bypassed by anyone, on every account
**File:** `src/app/(admin)/admin/login/actions.ts` → `loginAction`

```ts
if (
  !twoFactorCode &&
  !verifyPoW({ ... })
) {
  return { error: "Security verification failed..." };
}
```

PoW is only checked when `twoFactorCode` is **empty**. `twoFactorCode` is read straight from the submitted form (`formData.get("twoFactorCode")`) with no proof that a 2FA challenge was ever issued for this login attempt.

That means an attacker can send `POST /admin/login` with `email`, `password`, and **any non-empty `twoFactorCode` value** (e.g. `"000000"`) and the PoW check is skipped entirely — for accounts that don't even have 2FA enabled. Inside `AdminAuthService.login()`, the `twoFactorCode` argument is only consulted when `user.isTwoFactorEnabled` is true, so for the ~majority of accounts without 2FA it's silently ignored and the password check proceeds unprotected by PoW.

**Impact:** The PoW gate (the thing meant to make scripted credential-stuffing/brute-force expensive) is trivially opt-out by the attacker. Combined with the fact that account lockout only kicks in after 5 failed attempts and lasts 15 minutes, this substantially weakens brute-force resistance.

**Fix:** Only skip PoW when a *server-issued* 2FA challenge actually exists for that email (e.g. check `user.twoFactorExpires` is in the future / a signed "step 2" token from the first response), never just because the client sent a truthy field.

---

### 2. Stock reservations are never released for abandoned checkouts (phantom "sold out")
**Files:** `src/modules/shop/services/order.service.ts`, `src/modules/admin/services/inventory.service.ts`

`createPendingOrder` reserves stock atomically the moment a Razorpay order is created (`reserveStockForOrder`). That reservation is only released in two places:
- `markOrderFailed` (called from `/api/payment/verify` on bad signature, or the `payment.failed` webhook)
- `markOrderPaid` (converts reservation → deduction)

There is **no scheduled job, cron route, or TTL** anywhere in the bundle that expires stale `pending` orders that never receive *any* webhook/verify call (customer closes the tab at the Razorpay screen, payment widget fails to load, network drops, etc.). I searched the whole bundle for cleanup/cron/expiry logic — there is none (`grep -i "cron|stale|abandon|cleanup"` only matches unrelated UI copy).

**Impact:** Every abandoned checkout permanently locks a unit of stock as "reserved" (`quantityReserved`) with no way to reclaim it short of a manual DB fix. On a catalog with thin margins per SKU this will eventually make products show as out-of-stock while real physical stock sits unsold. This directly undermines the otherwise well-built atomic reservation system in `inventory.service.ts`.

**Fix:** Add a scheduled sweep (cron route / queue job) that finds `Order.status = 'pending'` older than e.g. 30–60 minutes with `stockReserved = true` and calls `markOrderFailed`/`releaseReservationForOrder` on them.

---

## 🟠 High

### 3. CSV/Excel exports are vulnerable to formula injection
**Files:** `src/lib/admin/csv.ts` (`csvCell`), `src/app/api/admin/finance/export/route.ts` (inline escaper), `src/app/api/admin/audit-logs/export/route.ts` (`csvEscape`)

All three CSV-building helpers only escape `,`, `"`, and newlines. None of them neutralize a leading `=`, `+`, `-`, or `@`, which Excel/Google Sheets treat as the start of a formula. Fields that flow straight from **public, unauthenticated user input** into these exports:

- `Order.customerName`, `Order.customerEmail` (from the public checkout form) → `orders/export`, `finance/export`
- `Contact.name`, `Contact.company`, `Contact.phone` (CRM contacts, some created by admins but potentially by public-facing forms too) → `contacts/export`
- `Subscriber.email` → `subscribers/export`

**Impact:** A customer can check out with a name like `=HYPERLINK("http://evil.example","click")` or `=cmd|'/c calc'!A1`-style payloads. When an admin opens the exported CSV in Excel, this can trigger malicious hyperlinks or (on older Excel/DDE-enabled configs) command execution — a classic CSV injection attack against your own back-office staff.

**Fix:** In `csvCell`/`csvEscape`, if the trimmed value starts with `=`, `+`, `-`, `@`, or a tab/CR, prefix it with a single quote `'` (or a space) before applying the existing quoting logic. Centralize all three export routes onto the one shared `toCsv`/`csvCell` helper (see finding #10) so the fix only has to be made once.

---

### 4. Coupon system is fully built in the admin panel but never wired into checkout
**Files:** `src/app/(admin)/admin/(console)/phase2-actions.ts`, `src/app/api/admin/coupons/route.ts`, `prisma/schema.prisma` (`Coupon` model), `src/app/api/checkout/route.ts`, `src/modules/shop/services/order.service.ts`

The admin console has a complete coupon CRUD (`saveCouponAction`, `toggleCouponAction`, `deleteCouponAction`, the `/api/admin/coupons` route, and a `MarketingPanel` UI described as *"Coupon codes for checkout..."*). The `Coupon` model even has a `usedCount` counter and `maxUses`/`expiresAt` fields ready for redemption tracking.

However, I grepped the entire storefront/checkout path (`checkoutSchema`, `priceCart`, `createPendingOrder`) and there is **no code anywhere that accepts a coupon code from the customer, looks it up, validates `active`/`expiresAt`/`maxUses`, applies a discount to `subtotalCents`/`totalCents`, or increments `usedCount`.** Admins can create and "activate" coupons that customers can never actually use.

**Impact:** This isn't a bug so much as a half-shipped feature — but it's worth flagging explicitly because the admin UI actively implies it works ("Active coupons" KPI on the dashboard), which will confuse whoever runs the store into thinking discounts are live.

**Fix:** Either (a) add a `couponCode` field to the checkout schema, validate it server-side in `priceCart`/`createPendingOrder`, apply the discount, and atomically increment `usedCount` (guarding against races the same way stock reservation does), or (b) remove/hide the coupon UI until that's built, so it doesn't look finished.

---

### 5. Two-factor "resend code" cooldown is broken — blocks legitimate resends for ~9 minutes instead of 60 seconds
**File:** `src/lib/admin/two-factor.ts` → `generateAdminTwoFactorCode`

```ts
if (user.twoFactorExpires && user.twoFactorExpires.getTime() > Date.now() - COOLDOWN_MS) {
  return { ok: false, reason: "cooldown" };
}
```

`twoFactorExpires` is set to *now + 10 minutes* whenever a code is generated. The cooldown check compares that **expiry** timestamp against `now - 60s`, not a "last sent" timestamp. Since `expiresAt` (≈ now+10min) is virtually always greater than `now - 60s`, this condition stays true for the entire ~10-minute lifetime of the code, not just the intended 60-second cooldown window.

**Impact:** A legitimate admin who didn't receive their email (spam filter, slow SMTP, etc.) cannot request a new code for up to 10 minutes, not the 60 seconds the code and error message ("wait a minute") imply. This is a real usability/lockout bug, not just cosmetic — it can strand an admin who legitimately needs a fresh code because the first one expired or bounced.

**Fix:** Store a separate `twoFactorLastSentAt` (or reuse the code's *issued-at*, i.e. `expiresAt - CODE_EXPIRY_MS`) and compare that against `COOLDOWN_MS`.

---

### 6. Audit-log CSV export silently truncates to 100 rows instead of the requested 5000
**Files:** `src/app/api/admin/audit-logs/export/route.ts`, `src/modules/admin/services/audit.service.ts` (`listAuditLogs`)

The export route calls:
```ts
listAuditLogs({ page: 1, pageSize: 5000, ... })
```
but `listAuditLogs` internally does:
```ts
const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
```
So the requested `5000` is clamped down to `100` with no error, warning, or indication in the response. An admin exporting "all" audit logs for a compliance review or incident investigation gets only the 100 most recent entries and has no way to know the export is incomplete.

**Fix:** Give the export path its own unbounded (or much higher, e.g. 10,000) query rather than reusing the paginated admin-UI helper's clamp, or make the clamp a parameter instead of a hardcoded constant.

---

## 🟡 Medium

### 7. Session hijack protection ("UA mismatch" logout) is built but never actually runs
**Files:** `src/lib/admin/auth-context.ts` (`withAdminAuth`, `getAdminFromRequest`), `src/lib/admin/auth-service.ts` (`touchSession`)

`AdminAuthService.touchSession()` compares the stored session's `userAgent` against the current request's UA and force-logs-out the session on mismatch — a reasonable lightweight session-hijacking mitigation. But it is only ever called from `getAdminFromRequest()` in `auth-context.ts`, and I confirmed with a full-bundle grep that **`withAdminAuth`/`getAdminFromRequest` are never imported or used by any route**. Every real admin route uses `requireAdminApi`/`requireAdminRole` (in `lib/admin/api.ts`) or `requireAdminSession` (in `lib/auth.ts`), neither of which calls `touchSession`.

**Impact:** Not a hole by itself (sessions are still validated against the DB for revocation/expiry), but the UA-binding protection you clearly intended to have is dead code — it gives a false sense of an extra security layer that isn't actually enforced anywhere. `lastUsedAt` also never gets updated in practice, which will make the "last used" timestamps shown in `getOwnSessions()` misleading (they'll only update once, at login).

**Fix:** Either delete `auth-context.ts` if it's superseded, or wire `touchSession` into the real request path (e.g. inside `requireAdminApi`/middleware).

---

### 8. `X-Forwarded-For` is trusted without validating a trusted proxy hop
**File:** `src/lib/rate-limit-edge.ts` → `clientIpFromRequest`

```ts
const forwarded = request.headers.get("x-forwarded-for");
if (forwarded) {
  const first = forwarded.split(",")[0]?.trim();
  if (first) return first;
}
```

This takes the **left-most** entry of `X-Forwarded-For`, which is the value the *client* sends, not the value your edge/proxy appends. Unless your deployment platform is guaranteed to strip/overwrite any client-supplied `X-Forwarded-For` before it reaches this code (true on some platforms, not guaranteed on all), an attacker can set an arbitrary `X-Forwarded-For` header to get a fresh IP identity on every request and bypass every rate limiter built on top of this function (login attempts, checkout spam, newsletter spam, upload flooding) — all four rate limiters in `middleware.ts` key off this same function.

**Fix:** Confirm your hosting platform (Vercel/Cloudflare/etc.) appends rather than trusts the incoming header, and if not, read from the platform-specific trusted header (e.g. `cf-connecting-ip`) or take the right-most/second-to-last hop instead of the first.

---

### 9. Marketing "send campaign" has no batching, throttling, or delivery-failure handling for the storefront
**File:** `src/app/(admin)/admin/(console)/phase2-actions.ts` → `sendCampaignAction`

```ts
for (const recipient of recipients) {
  const ok = await sendAdminMail({ to: recipient.email, ... });
  if (ok) delivered += 1;
}
```

Emails are sent one-by-one, sequentially awaited, inside a single server action invocation with no batching, no delay between sends, and no persistence of *which* recipients succeeded/failed (only a total `delivered` count). Two consequences:
- On serverless hosting, a large subscriber list can exceed the platform's function execution time limit mid-send, leaving the campaign stuck in a non-`sent` status with no record of who already got the email — a retry would resend to everyone.
- Rapid-fire sending from one SMTP connection can trip your provider's rate limits or get the sending domain flagged as spammy; there's no `unsubscribe` link in the email body either (`campaign.body` goes out verbatim), which is worth a note if this is used for real newsletters.

**Fix:** Move sending to a background job/queue with batching + rate limiting, persist per-recipient delivery state, and append an unsubscribe link/footer.

---

### 10. Three separate, inconsistent CSV-escaping implementations
**Files:** `src/lib/admin/csv.ts`, `src/app/api/admin/finance/export/route.ts`, `src/app/api/admin/audit-logs/export/route.ts`

There's a shared `toCsv`/`csvCell` helper, but `finance/export/route.ts` and `audit-logs/export/route.ts` each hand-roll their own near-identical (but not identical) escaping function instead of importing the shared one. This is how #3 above ends up needing three fixes instead of one, and it's a general maintenance smell — any future escaping fix has to be applied in three places and will likely be missed in at least one.

**Fix:** Delete the two local copies and import `csvCell`/`toCsv` everywhere.

---

### 11. Dashboard "low stock" count ignores reserved stock (inconsistent with the inventory screen)
**Files:** `src/modules/admin/services/dashboard.service.ts` (`getDashboardStats`, `listLowStockProducts`), `src/modules/admin/services/inventory.service.ts` (`listInventory`)

The Inventory screen correctly computes *available* stock as `quantityOnHand - quantityReserved` and flags low stock off that (`isLow: available <= threshold`). The Dashboard's low-stock KPI and "Low stock products" widget instead use `Product.stockQty` directly (which mirrors `quantityOnHand`, **not** availability):

```ts
const lowStockCount = stockCandidates.filter((p) => p.stockQty <= p.lowStockThreshold).length;
```

**Impact:** A product with plenty of on-hand stock but most of it tied up in unreleased reservations (see #2) will show as healthy on the Dashboard while the Inventory page correctly shows it as low/unavailable — two screens disagreeing about the same fact, which will erode trust in the dashboard numbers.

**Fix:** Reuse the same `quantityOnHand - quantityReserved` calculation (ideally via a shared `getProductAvailability`/`listInventory` call) for the dashboard KPIs.

### 12. Password change doesn't revoke the admin's other active sessions
**File:** `src/app/(admin)/admin/(console)/account-actions.ts` → `changeOwnPasswordAction`

Compare with `resetAdminPasswordAction` (owner resetting *another* user's password), which correctly calls `AdminAuthService.revokeAllSessions(id)` right after rotating the hash. `changeOwnPasswordAction` (self-service password change) does **not** revoke other sessions after a successful change. If a user is changing their password *because* they suspect their account is compromised, an attacker's already-active session (stolen cookie, shared device, etc.) stays valid until it naturally expires.

**Fix:** Call `AdminAuthService.revokeAllSessions(user.id, admin.sessionId)` (keeping the current session alive) at the end of `changeOwnPasswordAction`.

---

## 🔵 Low / Polish

### 13. Content-Security-Policy allows `'unsafe-inline'` and `'unsafe-eval'` for scripts
**File:** `src/middleware.ts` → `attachSecurityHeaders`

```
script-src 'self' 'unsafe-inline' 'unsafe-eval';
```

Every other security header here is solid (HSTS, X-Frame-Options, nosniff, Permissions-Policy), but this CSP directive removes most of the XSS defense-in-depth value a CSP is supposed to provide — `'unsafe-inline'`/`'unsafe-eval'` mean an injected `<script>` tag or `eval()`'d string will execute just fine. If this is a Next.js-inline-script requirement, consider moving to nonce- or hash-based CSP instead of blanket `unsafe-inline`.

### 14. Naive regex "WAF" in middleware can false-positive on legitimate content
**File:** `src/middleware.ts` → `isSuspiciousUrl`

The SQLi/XSS regex patterns run against the raw URL (not body), which limits blast radius, but things like a blog/product slug containing the word "select" next to "union" (unlikely but possible in scientific/biotech copy — e.g. a slug mentioning gene "selection") or a query string with `on` + `=` (e.g. `?onSale=true`) could theoretically 403 a legitimate request. Low risk given it's URL-only, but worth a passing note since it's user-facing (returns a blank 403 with no explanation).

### 15. `listInventory({ lowOnly: true })` loads the entire inventory table into memory
**File:** `src/modules/admin/services/inventory.service.ts` → `listInventory`

When `lowOnly` is set, pagination (`skip`/`take`) is skipped entirely and the *whole* inventory result set is fetched, then filtered/sliced in JS. Fine at small catalog sizes; will degrade as the product catalog grows.

### 16. Minor: `AdminTokenService` access-token expiry (24h) is long for an admin panel handling PII/finance/payment data
**File:** `src/lib/admin/tokens.ts`

Not wrong, but worth a deliberate call: a stolen access-token cookie stays usable for up to 24h (mitigated somewhat by the refresh-rotation reuse-detection and revocation checks on server-rendered pages, but see #7 re: the UA-binding layer not actually running). Consider shortening to something like 1–2h if this handles sensitive customer/financial data, relying on the existing silent refresh (`AdminSessionKeepalive`) to keep sessions alive.

---

## What's actually solid (so the above isn't misread as "everything is broken")

Worth calling out explicitly since a lot of this codebase is genuinely careful:
- **Inventory reservation** (`reserveStock`/`reserveStockForOrder`) uses guarded atomic `UPDATE ... WHERE (onHand - reserved) >= qty` raw SQL specifically to prevent oversell races — this is the correct pattern and well implemented.
- **Checkout pricing** is fully re-derived server-side from the DB (`priceCart`); the client never gets to dictate price/total.
- **Payment verification** double-checks via both the client-triggered `/api/payment/verify` *and* the Razorpay webhook, with proper idempotency (`paymentEvent` unique constraint) and a "never downgrade a paid order" guard in `markOrderPaid`/`markOrderFailed`.
- **Password/session security fundamentals** are good: peppered bcrypt hashing with a legacy-migration path, timing-safe comparisons throughout, account lockout after repeated failures, refresh-token rotation with reuse detection, HttpOnly/SameSite cookies, JWE-encrypted session cookie on top of the signed JWT.
- **Admin server actions** (create/update/delete across products, team, blog, media, patents, contacts, coupons, expenses) consistently perform explicit role checks (`hasAdminRole`) and write to the audit log — I specifically went looking for actions missing an auth check and didn't find any real ones.
- **Self-protection logic** in user management (`updateAdminUserAction`) correctly prevents an owner from demoting/deactivating themselves or removing the last active owner.
- **Image upload** sniffs real magic bytes instead of trusting the client's declared content-type.

---

## Suggested priority order to fix

1. #1 (PoW bypass) — trivial for an attacker to find, undermines your main anti-brute-force control.
2. #2 (stock never released) — will cause real, ongoing revenue-visible bugs ("out of stock" that isn't) the longer the store runs.
3. #3 (CSV formula injection) — quick, low-risk fix (one function), removes a real attack path against your own staff.
4. #5 and #6 (2FA cooldown, audit export truncation) — quick logic fixes, both currently mislead the admin using them.
5. #4 (coupon system) — decide direction (finish it or hide it) before it's relied on.
6. Everything in Medium/Low as time allows — #7, #8, #12 are cheap security hardening; #9, #11, #13–16 are correctness/scale polish.
