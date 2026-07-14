# Feature Spec: Customer Accounts, Guest Checkout & Order History Linking

## What you asked for, restated

- Checkout stays **guest-first** — a customer can still place an order without creating an account (current behavior, unchanged).
- Add an **optional customer account system** — completely separate from the admin panel (different login, different session, different users table). A customer logging in should never be able to reach `/admin/*`, and an admin logging in should never be treated as a customer.
- If a customer **did** check out as a guest, and **later** creates an account (or already has one) using the **same email** they used at checkout, their past guest orders should automatically show up in their order history — they shouldn't have to do anything special to "claim" them.

This document is an implementation guide for that, written to match the existing codebase's patterns (Next.js App Router, Prisma, `zod` validation, the `AdminPasswordService`/`AdminTokenService` style already used for the admin panel).

---

## 1. Why this needs a security decision up front — read before building

Right now, `Order.customerEmail` is just whatever the customer typed into the checkout address form — it is **never verified**. That's fine for guest checkout (you email order confirmations to it, no different from any storefront).

But the moment you auto-link "any order with this email" to "whoever signs up with this email," you've created an account-takeover-adjacent risk:

> If Alice orders as a guest using `alice@example.com`, and an attacker who knows/guesses that email signs up for an account with `alice@example.com` **before Alice does**, the attacker's new account would auto-inherit Alice's order history (name, address, phone, what she bought) — unless you gate the linking behind proof that the signer-upper actually controls that inbox.

**Recommendation (do this):** Require **email verification** before:
1. A new customer account is considered "active" enough to log in, **and**
2. Any historical guest orders are linked to it.

This is a standard "verify email" flow (send a verification link/code, click/enter it, then activate the account + do the linking). It adds a little scope but it's the right call given this store handles real names, phone numbers, and shipping addresses. If you decide to skip verification for a v1, at minimum **do not skip it for the order-linking step** — an unverified account should be able to log in and place new orders, but should not see orders it hasn't proven ownership of.

Everything below assumes email verification is in place. If you choose not to build it, replace "on verification success" with "on signup" in the flows below, but treat that as an explicit risk trade-off, not an oversight.

---

## 2. Data model changes

Add a new `Customer` model — **do not** reuse `AdminUser`. Keep the two completely separate tables/roles; this also means a leaked admin credential can never be used to log into the storefront and vice versa.

```prisma
model Customer {
  id                String    @id @default(cuid())
  email             String    @unique
  passwordHash      String
  name              String?
  phone             String?
  emailVerifiedAt   DateTime?
  active            Boolean   @default(true)

  failedLoginAttempts Int      @default(0)
  lockedUntil         DateTime?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  orders            Order[]
  sessions          CustomerSession[]
  verificationTokens CustomerVerificationToken[]

  @@index([email])
}

model CustomerSession {
  id           String   @id @default(cuid())
  customerId   String
  customer     Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  ipAddress    String?
  userAgent    String?
  isRevoked    Boolean  @default(false)
  expiresAt    DateTime
  lastUsedAt   DateTime @default(now())
  createdAt    DateTime @default(now())

  @@index([customerId])
}

model CustomerRefreshToken {
  id         String   @id @default(cuid())
  sessionId  String
  tokenHash  String   @unique
  revoked    Boolean  @default(false)
  expiresAt  DateTime
  createdAt  DateTime @default(now())

  @@index([sessionId])
}

/** Used for both "verify your email" and "reset your password" links. */
model CustomerVerificationToken {
  id          String   @id @default(cuid())
  customerId  String
  customer    Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  tokenHash   String   @unique
  purpose     CustomerTokenPurpose
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([customerId, purpose])
}

enum CustomerTokenPurpose {
  email_verify
  password_reset
}
```

And extend the existing `Order` model with a **nullable** link to `Customer`:

```prisma
model Order {
  // ...existing fields unchanged...
  customerId   String?
  customer     Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)

  @@index([customerId])
  // customerEmail already exists — keep it, it's still needed for guest orders
}
```

Why nullable: guest orders will always have `customerId = null` and rely on `customerEmail` only, exactly like today. Logged-in orders get both set. This is a purely additive migration — nothing about the existing guest checkout flow breaks.

---

## 3. Where new code lives (mirrors the admin structure you already have)

```
src/lib/customer/
  auth-service.ts       // signup / login / logout / session, mirrors AdminAuthService
  password.ts           // reuse the SAME hashing approach as AdminPasswordService
                         // (bcrypt + pepper) — but use a DIFFERENT pepper env var,
                         // e.g. CUSTOMER_PASSWORD_PEPPER, so the two user pools are
                         // cryptographically unrelated even if one pepper ever leaks
  tokens.ts              // JWT access/refresh, mirrors AdminTokenService but its own
                         // JWT_AUDIENCE ("cashmir-customer") / issuer, and its own
                         // encrypted cookie name — never reuse the admin cookie name
  order-linking.ts       // the "attach guest orders to this customer" logic (§5)
  verification.ts        // generate/verify email-verification + password-reset tokens

src/app/(shop)/account/
  login/page.tsx
  signup/page.tsx
  verify-email/page.tsx
  orders/page.tsx         // customer-facing order history
  orders/[orderNumber]/page.tsx
  actions.ts               // "use server" actions: signup, login, logout, etc.

src/app/api/account/
  auth/login/route.ts
  auth/logout/route.ts
  auth/refresh/route.ts
  auth/verify-email/route.ts
  auth/resend-verification/route.ts
  auth/forgot-password/route.ts
  auth/reset-password/route.ts
```

Keep this entirely out of `src/app/(admin)/` and `src/lib/admin/`. Different cookie name (e.g. `cb_customer_session` vs. the existing `ADMIN_SESSION_COOKIE`), different JWT audience/issuer constants, different middleware matcher.

---

## 4. Auth mechanics — reuse patterns you already trust, don't reinvent

You already have a solid, audited pattern in the admin code. Copy its *shape*, not its literal code, for the customer side:

| Concern | Admin pattern to mirror |
|---|---|
| Password hashing | `AdminPasswordService` — bcrypt(12 rounds) + HMAC pepper, timing-safe compare, dummy-hash on unknown user |
| Access/refresh tokens | `AdminTokenService` — short-lived signed JWT access token + longer-lived rotating refresh token, refresh-token-reuse detection |
| Session cookie | JWE-encrypted cookie wrapping the JWT (`encryptToken`/`decryptToken`), `httpOnly`, `secure` in prod, `sameSite: "lax"` |
| Lockout | 5 failed attempts → 15 min lockout, same as `AdminAuthService.login` |
| Rate limiting | Add a `getCustomerLoginRatelimit()` / `getCustomerSignupRatelimit()` next to the existing ones in `rate-limit-edge.ts`, wired into `middleware.ts` the same way the admin-login limiter is |

Things to do **differently** from the admin flow, on purpose:
- **No PoW challenge required for customer login/signup** (that's overkill for a storefront and adds friction for real shoppers) — rely on the rate limiter + lockout instead. If you do want extra bot resistance on signup specifically, a normal CAPTCHA is a better fit here than PoW.
- **Shorter access-token lifetime is not necessary here** — a customer session is lower-value than an admin session, 7–30 days with silent refresh is reasonable (no need to match the admin's tighter posture).
- **No RBAC** — customers have exactly one role (customer). Don't build a roles system for this.

---

## 5. The actual order-linking logic

This is the part you specifically asked for. Put it in `src/lib/customer/order-linking.ts`:

```ts
import "server-only";
import { db } from "@/lib/db";

/**
 * Attaches any existing guest orders that used this email to the given
 * (now-verified) customer account. Only call this AFTER the customer's
 * email has been verified — see §1.
 *
 * Idempotent: safe to call more than once (e.g. also on every login, as a
 * backstop in case a guest order came in between signup and verification).
 */
export async function linkGuestOrdersToCustomer(customerId: string, email: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const result = await db.order.updateMany({
    where: {
      customerId: null,                 // only unclaimed orders
      customerEmail: normalizedEmail     // exact, case-insensitive match
    },
    data: { customerId }
  });

  return { linkedCount: result.count };
}
```

Call this from **two** places:
1. **Right after email verification succeeds** (primary path — see §6).
2. **On every successful login** as a cheap backstop (covers the case where a guest order came in during the window between signup and clicking the verification link). This is a single indexed `UPDATE ... WHERE customerId IS NULL AND customerEmail = ?`, essentially free to run on every login.

Do **not** call it at signup time before verification — that's exactly the account-takeover window described in §1.

Also make sure checkout itself is customer-aware (see §7) so that going forward, a *logged-in* customer's orders get `customerId` set immediately and never need "linking" at all — linking only matters for (a) pre-existing guest orders and (b) orders placed by a logged-in-looking browser whose session had actually expired (edge case, but the login-time backstop above covers it too).

---

## 6. Signup / verification flow

1. **Checkout completes as guest** (unchanged) → confirmation page shows: *"Want to track this order and speed up checkout next time? Create an account with `<email they just used>`."* Prefill the signup form's email field from the order, but let them change it.
2. **Signup form** (`/account/signup`): email + password (+ optional name/phone). On submit:
   - If a `Customer` already exists with this email → don't say "email taken" (enumeration); instead say *"If an account exists for this email, we've sent a verification link"* and, if it exists and is unverified, resend the verification email; if it exists and **is** verified, send a "you already have an account — log in / reset password" email instead of a verification link.
   - If no `Customer` exists → create one (`emailVerifiedAt: null`), issue a `CustomerVerificationToken` (purpose `email_verify`, ~24h expiry, single-use, hashed at rest exactly like the 2FA codes in `two-factor.ts`), email a verification link containing the raw token.
   - **Do not log the customer in yet** and **do not link orders yet.**
3. **Verification link** (`/account/verify-email?token=...`): looks up the token by its hash, checks not expired/used, marks it used, sets `Customer.emailVerifiedAt = now()`, then **calls `linkGuestOrdersToCustomer`**, then logs the customer in (issue session) and redirects to `/account/orders` with a "your past orders are now linked" message showing the count.
4. **Login** (`/account/login`): standard email+password. On success, call `linkGuestOrdersToCustomer` as the backstop (§5), then proceed. If `emailVerifiedAt` is still null, still let them log in (they can browse/shop) but show a "please verify your email to see order history" banner and don't show past-guest orders until verified — only orders they place *while logged in* (which get `customerId` set directly at checkout, see §7) should show for an unverified account.

---

## 7. Checkout changes (minimal — keep guest checkout the default)

In `src/app/api/checkout/route.ts` / `createPendingOrder`:

- If the request includes a valid customer session cookie, resolve the logged-in `customerId` server-side (never trust a `customerId` sent in the request body) and pass it into `createPendingOrder`, which sets `Order.customerId` at creation time — no linking step needed for these.
- If there's no session (guest, or a customer chose "checkout as guest" while logged out), behave exactly as today: `customerId` stays `null`, only `customerEmail` is stored.
- Add a checkbox on the checkout form, shown only when **not** logged in: *"Save my info and create an account"* — if checked, after the order is successfully created, kick off the signup flow from §6 pre-filled with the checkout email/name/phone, instead of making them fill the signup form again from scratch.
- On the checkout page itself, if a `Customer` is logged in, prefill the address form from their saved default address (if you add one — optional, not required for this spec) and skip asking for name/email again.

---

## 8. Customer-facing order history page

`src/app/(shop)/account/orders/page.tsx` (auth-gated by the customer session, same pattern as `requireAdminSession` but for customers):

- List `db.order.findMany({ where: { customerId: currentCustomer.id }, orderBy: { createdAt: "desc" } })`.
- Reuse `getOrderSummaryByNumber` (already exists in `order.service.ts`) for the detail view — it's already "public-safe" shaped (no internal fields leaked), just add an ownership check: only render it if `order.customerId === currentCustomer.id` **or** it's a guest lookup by order number (keep the existing `/order/[orderNumber]` guest-lookup page working exactly as it does today — that's unrelated to accounts and shouldn't require login).
- Nothing here needs pagination logic you haven't already built — copy the pattern from the admin orders table (`pagination.tsx`, `orders-table.tsx`) styled for the storefront instead.

---

## 9. Things to explicitly test before shipping this

- [ ] Guest checkout still works with **no account and no session cookie present at all** — this must never regress.
- [ ] Signing up with an email that has 3 prior guest orders → after verifying, all 3 show up in order history, and no others do.
- [ ] Signing up with an email that has **zero** prior orders → order history is empty, no errors.
- [ ] Attempting to sign up with an email that already has a **verified** account → no new account created, no order data leaked, generic "check your email" style response either way (no enumeration).
- [ ] An **unverified** account cannot see guest orders for its email (place a guest order, sign up but don't click the verify link, confirm order history is empty until verification).
- [ ] A customer session cookie never authenticates against `/admin/*`, and an admin session cookie never authenticates against `/account/*` (different cookie names, different `verify*` functions, different JWT audience — write a quick test that swaps the cookies and confirms both are rejected).
- [ ] Logging in as customer A does not show customer B's orders even if they share a device/browser (standard session isolation, but worth an explicit test given the linking logic touches `customerEmail`).
- [ ] Rate limiting: repeated failed customer logins lock the account the same way admin lockout does, and repeated signups from one IP are throttled.
- [ ] Placing an order while logged in sets `customerId` immediately (verify in DB) — no reliance on the linking backstop for the logged-in path.

---

## 10. Summary of the actual behavior you'll get

- Checkout: **guest by default**, optional "create an account" at any point.
- Two completely separate login systems: `/admin/login` for staff, `/account/login` for customers — separate tables, separate sessions, separate cookies, no shared code path that could blur the two.
- A customer who orders as a guest and later creates an account **with the same, verified email** automatically sees all their past guest orders in one place — no manual "claim my order" step needed.
- The one deliberate friction point is **email verification before order history is linked**, which exists specifically to stop a stranger from creating an account with someone else's email and inheriting their order history/address/phone.
