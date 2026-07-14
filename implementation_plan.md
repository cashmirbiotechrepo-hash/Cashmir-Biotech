# Fix All Audit Report Issues — Implementation Plan

This plan addresses all **6 Critical**, **14 High**, **10 Medium**, and **8 Low** severity issues from the audit report plus the actionable items from security, performance, database, API, DevOps, and code quality sections.

> [!IMPORTANT]
> Some items from the audit report are **infrastructure/ops changes** (CI/CD pipelines, staging environments, monitoring services, cloud storage providers) that require external service configuration and cannot be fully implemented via code changes alone. These are marked with 🔧 and will be implemented as code-level scaffolding + documentation.

> [!WARNING]
> **CRIT-05 (file uploads to cloud storage)** requires choosing a storage provider. This plan implements **Vercel Blob** as the simplest option for the existing Vercel deployment target. If you prefer S3/R2/Cloudinary instead, let me know before I proceed.
>
> **HIGH-01 (test suite)** is scaffolded with Vitest config + example tests for critical business logic. A full 80% coverage test suite is a multi-day effort that should be done incrementally.
>
> **MED-04 (ProductImage join table)** and **HIGH-12 (mrpInr→pricePaise)** require database migrations that would break existing data. These are planned as safe additive migrations with backward compatibility.

---

## Open Questions

> [!IMPORTANT]
> 1. **CRIT-05**: Should I use **Vercel Blob** (simplest, works out of the box on Vercel) or do you prefer **AWS S3 / Cloudflare R2**?
> 2. **HIGH-12**: Renaming `mrpInr` to `pricePaise` changes the DB column. Should I do this now (requires a data migration) or add `pricePaise` as a new column alongside `mrpInr` for backward compatibility?
> 3. **MED-04**: Creating a `ProductImage` table means migrating existing `images String[]` data. Should I do this in this batch or defer?

---

## Proposed Changes

### Phase 1: Critical Security & Data Integrity Fixes

---

#### CRIT-01: Rotate Secrets in `.env`

##### [MODIFY] [.env](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/.env)
- Replace placeholder `JWT_SECRET` with a generated 64-char cryptographically random string
- Add `ENCRYPTION_KEY` (32 bytes)
- Add `PASSWORD_PEPPER` (32+ chars)  
- Remove `CHECKOUT_SKIP_PAYMENT` and `NEXT_PUBLIC_CHECKOUT_SKIP_PAYMENT` (also fixes **HIGH-05**)
- Add comment warning against committing this file

##### [MODIFY] [.env.example](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/.env.example)
- Remove `NEXT_PUBLIC_CHECKOUT_SKIP_PAYMENT` line
- Add stronger guidance on generating secrets

---

#### CRIT-02: Transactional Order Creation + Stock Reservation

##### [MODIFY] [order.service.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/modules/shop/services/order.service.ts)
- Wrap `createPendingOrder()` in `db.$transaction()` with Serializable isolation
- Pass the transaction client (`tx`) to `reserveStockForOrder()`
- Remove the manual rollback `catch` — the transaction auto-rolls-back on throw

##### [MODIFY] [inventory.service.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/modules/admin/services/inventory.service.ts)
- Add optional `tx?: Prisma.TransactionClient` parameter to `reserveStockForOrder()` and `ensureInventory()`
- Use `tx ?? db` pattern so existing non-transactional callers still work

---

#### CRIT-03: Move PoW Challenge Tracking to Redis (with In-Memory Fallback)

##### [MODIFY] [pow.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/admin/pow.ts)
- Replace `Map<string, number>` with Redis `SETNX` + TTL when Upstash is configured
- Keep in-memory fallback for development (non-production) only
- Remove `setInterval` cleanup timer
- Remove dev-only `SKIP_DEV` bypass in production

---

#### CRIT-04: Rate Limiting Mandatory in Production + In-Memory Fallback for Dev

##### [MODIFY] [rate-limit-edge.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/rate-limit-edge.ts)
- Refactor all 5 rate limiter factories into a single `createRateLimiter()` helper (also fixes **Code Refactoring #1**)
- Add in-memory sliding window fallback for development
- Log a warning when falling back to in-memory
- Throw at startup in production if Redis is not configured

---

#### CRIT-05: Cloud File Uploads (Vercel Blob)

##### [MODIFY] [upload/route.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/app/api/admin/upload/route.ts)
- Replace `writeFile` to local FS with Vercel Blob `put()` when `BLOB_READ_WRITE_TOKEN` is configured
- Keep local filesystem as development fallback
- Return the blob URL instead of `/uploads/...`

##### [MODIFY] [.env.example](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/.env.example)
- Add `BLOB_READ_WRITE_TOKEN` documentation

---

#### CRIT-06: Customer OTP Timing-Safe Comparison

##### [MODIFY] [customer/auth.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/customer/auth.ts)
- Replace `otp.codeHash !== hashOtp(code)` with `timingSafeEqual()` comparison
- Extract a `safeCompareHashes()` helper to reuse across admin and customer auth

---

### Phase 2: High Priority Fixes

---

#### HIGH-01: Test Suite Scaffolding

##### [NEW] vitest.config.ts
- Configure Vitest with path aliases matching tsconfig
- Set up test environment for Node.js

##### [MODIFY] [package.json](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/package.json)
- Add `vitest` and `@vitest/coverage-v8` to devDependencies
- Add `"test"`, `"test:coverage"` scripts

##### [NEW] src/modules/shop/services/__tests__/order.service.test.ts
- Test `priceCart()`, `generateOrderNumber()` business logic

##### [NEW] src/lib/admin/__tests__/password.test.ts
- Test `AdminPasswordService.hash()`, `.verify()`, `.timingSafeEqualStrings()`

---

#### HIGH-02: Remove `unsafe-inline` + `unsafe-eval` from CSP

##### [MODIFY] [middleware.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/middleware.ts)
- Tighten CSP: remove `'unsafe-eval'`, keep `'unsafe-inline'` only for `style-src` (required by many CSS-in-JS/framework patterns)
- Note: Full nonce-based CSP requires Next.js middleware nonce injection which is complex — this change removes the most dangerous `'unsafe-eval'` from scripts

---

#### HIGH-03: Consolidate Security Headers

##### [MODIFY] [next.config.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/next.config.ts)
- Remove the `headers()` function entirely — middleware handles all security headers dynamically

##### [MODIFY] [middleware.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/middleware.ts)
- Update `X-Frame-Options` to `DENY` (was `SAMEORIGIN`, conflicting with next.config)

---

#### HIGH-04: Customer Portal Middleware Auth Check

##### [MODIFY] [middleware.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/middleware.ts)
- Add customer session cookie verification for `/portal/*` routes (excluding `/portal/login`)
- Add `/portal/:path*` to the matcher config
- Add edge-safe customer token verification

##### [MODIFY] [auth-edge.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/auth-edge.ts)
- Add `verifyCustomerSessionToken()` for edge middleware

---

#### HIGH-06: Database Connection Pooling

##### [MODIFY] [db.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/db.ts)
- Add connection pool limits: `connection_limit=5` for serverless
- Add `pool_timeout=10` 
- Log connection pool configuration at startup

##### [MODIFY] [.env.example](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/.env.example)
- Add `?connection_limit=5&pool_timeout=10` to example DATABASE_URL

---

#### HIGH-07: SMTP Transport Singleton

##### [MODIFY] [mail.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/admin/mail.ts)
- Create transport once and reuse via singleton pattern
- Add transport connection verification on first use

---

#### HIGH-08: Cron Secret Timing-Safe Comparison

##### [MODIFY] [release-stale-orders/route.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/app/api/cron/release-stale-orders/route.ts)
- Replace `provided !== expected` with `timingSafeEqual`
- Handle length mismatch safely

---

#### HIGH-09: Protect Seed Script from Production

##### [MODIFY] [seed.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/prisma/seed.ts)
- Add production guard at the top of `main()`
- Convert `deleteMany()` + `createMany()` to `upsert()` for products, patents, team members

---

#### HIGH-10: Shorten Customer Token Lifetime

##### [MODIFY] [customer/auth.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/customer/auth.ts)
- Change `ACCESS_TOKEN_EXPIRY` from `"30d"` to `"2h"` 
- Add customer refresh token creation + rotation (mirroring admin pattern)
- Add `CUSTOMER_REFRESH_COOKIE` constant

##### [MODIFY] [auth.constants.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/config/auth.constants.ts)
- Add `CUSTOMER_REFRESH_COOKIE` constant

---

#### HIGH-11: Coupon Validation in Checkout

##### [MODIFY] [order.service.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/modules/shop/services/order.service.ts)
- Add `couponCode?: string` to `priceCart()` input
- Validate coupon: active, not expired, not maxed out
- Apply discount (percent or fixed) to subtotal
- Increment `usedCount` atomically on order creation

##### [MODIFY] [checkout/route.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/app/api/checkout/route.ts)
- Add `couponCode` to checkout schema (optional)
- Pass to `priceCart()`

---

#### HIGH-13: Add Webhook Route to Middleware Matcher

##### [MODIFY] [middleware.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/middleware.ts)
- Add `/api/webhooks/:path*` to matcher
- Add webhook-specific rate limiting (generous: 100/min)

---

#### HIGH-14: Pagination on Customer Portal Queries

##### [MODIFY] [portal.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/customer/portal.ts)
- Add `page` and `pageSize` params to `getPortalOverview()`, `getCustomerOrders()`, `getCustomerDocuments()`
- Default `pageSize: 20`, max 50
- Return pagination metadata `{ items, total, page, pageSize, totalPages }`

---

### Phase 3: Medium Priority Fixes

---

#### MED-01: DB-Level Low-Stock Filter

##### [MODIFY] [inventory.service.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/modules/admin/services/inventory.service.ts)
- Replace JavaScript `.filter()` with Prisma `where` clause using raw SQL for computed column filter

#### MED-02: Request Body Size Limits

##### [MODIFY] [middleware.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/middleware.ts)
- Add `Content-Length` check for POST/PUT/PATCH requests on public API routes (max 64KB)

#### MED-03: Three.js Error Boundary

##### [NEW] src/components/experience/scene-error-boundary.tsx
- React error boundary component with static fallback for WebGL failures

#### MED-05: Add `updatedAt` to Missing Models (Prisma schema change)

##### [MODIFY] [schema.prisma](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/prisma/schema.prisma)
- Add `updatedAt DateTime @updatedAt` to `Expense`, `MediaAsset`
- Convert `BlogPost.status` to enum (`draft`, `published`, `archived`) — **MED-06**
- Add composite index `CustomerAddress(customerId, isDefault)` — **DB improvement**
- Add index `CustomerOtp(email, purpose, usedAt)` — **DB improvement**
- Add `deletedAt DateTime?` to `Product`, `Customer`, `Order` — **MED-10 soft deletes**

#### MED-08: CORS Configuration

##### [MODIFY] [middleware.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/middleware.ts)
- Add CORS headers for API routes (configurable allowed origins)

#### MED-09: Typed Shipping Address

##### [NEW] src/lib/validations/address.ts
- Zod schema for shipping address; reuse in checkout + invoice generation

---

### Phase 4: Low Priority + DevOps + Code Quality

---

#### Health Check Endpoint

##### [NEW] src/app/api/health/route.ts
- Check DB connectivity, return status

#### CI/CD Pipeline

##### [NEW] .github/workflows/ci.yml
- Lint, type-check, test on PR

#### Dependabot

##### [NEW] .github/dependabot.yml
- Weekly npm dependency updates

#### Stale Session Cleanup Cron

##### [MODIFY] [vercel.json](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/vercel.json)
- Add session cleanup cron entry

##### [NEW] src/app/api/cron/cleanup-sessions/route.ts
- Delete expired/revoked admin and customer sessions

#### Request ID Correlation

##### [MODIFY] [middleware.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/middleware.ts)
- Generate `X-Request-Id` header on every request

---

## Verification Plan

### Automated Tests
- `npm run test` — Vitest unit tests for business logic
- `npm run lint` — ESLint passes
- `npm run build` — TypeScript compiles without errors

### Manual Verification
- Admin login flow still works with new secrets
- Checkout flow works with coupon support
- Customer portal login via OTP still works
- File uploads work (local dev fallback)
- Seed script refuses to run in production mode
- Rate limiting returns 429 in dev (in-memory fallback)
