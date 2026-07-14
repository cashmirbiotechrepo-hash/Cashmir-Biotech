# Cashmir Biotech — Enterprise Production Audit Report

**Audited by**: 20-member Senior Engineering Review Board  
**Date**: 2026-07-14  
**Scope**: Full-stack audit — architecture through deployment  
**Verdict**: **Not production-ready for enterprise/million-user scale. Solid foundation with critical gaps.**

---

## Executive Summary

| Dimension | Score |
|---|---|
| **Overall** | **52 / 100** |
| **Production Readiness** | **38 / 100** |
| **Enterprise Readiness** | **28 / 100** |
| **Maintainability** | **68 / 100** |
| **Security** | **55 / 100** |
| **Performance** | **42 / 100** |
| **Scalability** | **35 / 100** |
| **UI/UX** | **65 / 100** |
| **Accessibility** | **30 / 100** |
| **Developer Experience** | **62 / 100** |
| **Business Logic** | **60 / 100** |
| **Reliability** | **40 / 100** |
| **Risk Level** | **🔴 HIGH** |

> [!CAUTION]
> This project has a well-structured foundation but contains **6 Critical** and **14 High** severity issues that would be immediate blockers in any enterprise production approval gate. Multiple issues could lead to data loss, financial discrepancy, or security breach under real-world traffic.

---

## Critical Issues

### CRIT-01: `.env` File Committed to Repository with Real Credentials

**Severity**: 🔴 CRITICAL  
**Component**: DevOps / Security  
**File**: [.env](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/.env)

**What is implemented**: The `.env` file contains a real PostgreSQL connection string with plaintext password (`Moalim@345`), the JWT secret (`change-this-to-a-long-random-secret`), and a pre-computed admin password hash.

**Why it is a problem**: Despite `.env` being in `.gitignore`, the file currently exists in the repository working tree. The JWT_SECRET is the literal placeholder string `"change-this-to-a-long-random-secret"` — only 36 characters of low entropy. Anyone who discovers this value can forge admin sessions. The admin password hash is for `"CashmirBiotech@2026"`, which is a dictionary-attackable password.

**Real-world consequences**: Complete admin account takeover. Forged JWT tokens. Full database access if the DB is network-exposed.

**Recommended solution**:
1. Rotate ALL secrets immediately (DB password, JWT_SECRET, ADMIN_PASSWORD_HASH)
2. Use a cryptographically random JWT_SECRET: `openssl rand -base64 48`
3. Add ENCRYPTION_KEY and PASSWORD_PEPPER to production env
4. Audit git history for any prior commits of `.env`
5. Use a secrets manager (Vercel env, AWS SSM, Vault) — never file-based secrets in production

---

### CRIT-02: No Database Transaction Isolation for Order Creation + Stock Reservation

**Severity**: 🔴 CRITICAL  
**Component**: Database / Business Logic  
**File**: [order.service.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/modules/shop/services/order.service.ts#L110-L171)

**What is implemented**: `createPendingOrder()` creates the order first, then reserves stock in a separate call. If the reservation fails, it tries to void the order.

**Why it is a problem**: The order creation and stock reservation are NOT in a single `db.$transaction()`. A crash between line 140 (order created) and line 148 (stock reserved) leaves an orphaned order with no reservation. Under concurrency, two orders can both be created for the last unit before either checks stock.

**Real-world consequences**: Overselling inventory. Ghost orders blocking the pipeline. Financial discrepancy between orders and actual stock.

**How to reproduce**: Send 50 concurrent checkout requests for a product with 1 unit in stock.

**Recommended solution**:
```typescript
return db.$transaction(async (tx) => {
  const order = await tx.order.create({ ... });
  const reservation = await reserveStockForOrder({ orderId: order.id, lines }, tx);
  if (!reservation.ok) {
    throw new Error(reservation.error); // auto-rollback
  }
  await tx.order.update({ where: { id: order.id }, data: { stockReserved: true } });
  return { ok: true, orderId: order.id, orderNumber };
}, { isolationLevel: 'Serializable' });
```

---

### CRIT-03: Proof-of-Work Anti-Bot Uses In-Memory Map — Broken in Serverless/Multi-Instance

**Severity**: 🔴 CRITICAL  
**Component**: Security / Authentication  
**File**: [pow.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/admin/pow.ts#L18-L28)

**What is implemented**: `usedChallenges` is a `Map<string, number>` stored in module-level memory. A `setInterval` cleans up old entries.

**Why it is a problem**: On Vercel (or any serverless/multi-instance deployment), each function invocation gets its own isolate. The `usedChallenges` map is never shared across instances. An attacker can replay a valid PoW solution against a different instance and it will be accepted. The `setInterval` also leaks memory in short-lived serverless contexts.

**Real-world consequences**: PoW anti-bot protection is effectively bypassed in production. Brute-force login attacks proceed unhindered.

**Recommended solution**: Move challenge tracking to Redis/Upstash with TTL-based expiry:
```typescript
const redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
async function markChallengeUsed(challenge: string) {
  const key = `pow:used:${challenge}`;
  const set = await redis.setnx(key, 1);
  if (!set) return false; // already used
  await redis.expire(key, Math.ceil(POW_CONFIG.validityWindowMs / 1000) * 2);
  return true;
}
```

---

### CRIT-04: Rate Limiting Is Silently Disabled Without Upstash Redis

**Severity**: 🔴 CRITICAL  
**Component**: Security / Infrastructure  
**File**: [rate-limit-edge.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/rate-limit-edge.ts#L19-L39)

**What is implemented**: Every rate limiter returns `null` if `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` are not configured.

**Why it is a problem**: There is NO fallback rate limiting. In the middleware, when `rl` is `null`, the request is allowed through unconditionally. No warning is logged that rate limiting is disabled. The `.env` file does not have Upstash configured, meaning ALL rate limiting is currently disabled — login brute force, checkout spam, newsletter spam, OTP brute force.

**Real-world consequences**: Unlimited brute-force attacks on admin login. Unlimited OTP guessing (max 5 per code, but unlimited new codes). Spam flood of checkout orders.

**Recommended solution**:
1. **Mandatory in production**: Throw an error at startup if Redis is not configured in `NODE_ENV=production`
2. **Local fallback**: Implement an in-memory sliding window limiter for development:
```typescript
if (!url || !token) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('UPSTASH_REDIS is required in production for rate limiting');
  }
  // In-memory fallback for dev
  ratelimitSingleton = createInMemoryRateLimiter(15, '1m');
  return ratelimitSingleton;
}
```

---

### CRIT-05: Admin File Upload Writes to Local Filesystem — Incompatible with Serverless

**Severity**: 🔴 CRITICAL  
**Component**: Infrastructure / File Storage  
**File**: [upload/route.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/app/api/admin/upload/route.ts#L42-L44)

**What is implemented**: Uploads are written to `public/uploads/` on the local filesystem using `writeFile`.

**Why it is a problem**: Vercel serverless functions have an ephemeral, read-only filesystem (except `/tmp`). Uploaded files will be lost on the next deployment or function cold start. Even `/tmp` is per-invocation. This architecture fundamentally does not work in production on any serverless platform.

**Real-world consequences**: All product images uploaded via admin panel are lost after deployment. Broken image links across the entire storefront.

**Recommended solution**: Use cloud object storage:
- **Vercel Blob** (simplest): `import { put } from '@vercel/blob'`
- **AWS S3 / Cloudflare R2**: Pre-signed upload URLs
- **Cloudinary**: If image transformation is needed

---

### CRIT-06: Customer OTP Comparison Uses Non-Constant-Time String Comparison

**Severity**: 🔴 CRITICAL  
**Component**: Security / Authentication  
**File**: [customer/auth.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/customer/auth.ts#L175)

**What is implemented**: `if (otp.codeHash !== hashOtp(code))` — a direct string comparison.

**Why it is a problem**: Unlike the admin 2FA (which uses `timingSafeEqual`), the customer OTP verification uses JavaScript's `!==` operator, which short-circuits on the first differing byte. This enables timing side-channel attacks to deduce the hash character-by-character.

**Real-world consequences**: An attacker with network proximity can statistically determine the OTP hash by measuring response times, bypassing the 5-attempt limit per code.

**Recommended solution**:
```typescript
import { timingSafeEqual } from 'crypto';
const a = Buffer.from(hashOtp(code));
const b = Buffer.from(otp.codeHash);
if (a.length !== b.length || !timingSafeEqual(a, b)) {
  // invalid
}
```

---

## High Priority Issues

### HIGH-01: No Test Suite Whatsoever

**Severity**: 🔴 HIGH  
**Component**: QA / Engineering

No unit tests, integration tests, or e2e tests exist anywhere in the project. No test framework is configured. No test scripts in `package.json`.

**Consequences**: Every deployment is a gamble. Refactoring is dangerous. Business-critical flows (checkout, payment, inventory) have zero automated validation.

**Recommendation**: 
- Add Vitest for unit/integration tests
- Add Playwright for e2e flows (checkout, admin login, portal OTP)
- Target 80% coverage on business logic (`modules/`, `lib/`)
- Add `"test": "vitest"` to `package.json`

---

### HIGH-02: CSP Header Includes `'unsafe-inline'` and `'unsafe-eval'`

**Severity**: 🔴 HIGH  
**Component**: Security  
**File**: [middleware.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/middleware.ts#L33-L34)

`script-src 'self' 'unsafe-inline' 'unsafe-eval'` completely negates XSS protection. Any injected `<script>` tag or inline event handler will execute.

**Recommendation**: Use nonce-based CSP with Next.js:
```
script-src 'self' 'nonce-{random}';
```

---

### HIGH-03: Duplicate Security Headers — next.config.ts vs Middleware

**Severity**: 🟡 HIGH  
**Component**: Infrastructure  
**Files**: [next.config.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/next.config.ts#L9-L22), [middleware.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/middleware.ts#L18-L37)

Security headers are set in BOTH `next.config.ts` headers() and `attachSecurityHeaders()` in middleware, with conflicting values:
- `next.config.ts`: `X-Frame-Options: DENY`  
- Middleware: `X-Frame-Options: SAMEORIGIN`

**Recommendation**: Consolidate to one location (middleware for dynamic, next.config for static). Remove duplication.

---

### HIGH-04: No Customer Session Validation in Middleware (Portal IDOR Risk)

**Severity**: 🔴 HIGH  
**Component**: Security / Authorization  
**File**: [middleware.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/middleware.ts)

The middleware only protects `/admin` routes. Customer portal routes (`/portal/*`) have NO middleware-level auth check. Customer session validation happens only at the page/component level via `requireCustomerSession()`. If any portal page or API forgets to call this, it's open.

**Recommendation**: Add portal auth check in middleware:
```typescript
if (pathname.startsWith('/portal') && !pathname.startsWith('/portal/login')) {
  // Verify customer session cookie
}
```

---

### HIGH-05: `CHECKOUT_SKIP_PAYMENT` Actively Enabled in `.env`

**Severity**: 🔴 HIGH  
**Component**: Business Logic / Security  
**File**: [.env](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/.env#L9-L11)

Both `CHECKOUT_SKIP_PAYMENT=true` and `NEXT_PUBLIC_CHECKOUT_SKIP_PAYMENT=true` are set. While the server-side check blocks this in production, the `NEXT_PUBLIC_` variable is exposed to the browser, signaling to any observer that payment skipping exists.

**Recommendation**: Remove both from `.env`. Never expose test bypass flags as `NEXT_PUBLIC_` variables.

---

### HIGH-06: No Connection Pooling Configuration for Database

**Severity**: 🔴 HIGH  
**Component**: Database / Scalability  
**File**: [db.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/db.ts)

The Prisma client is created with no connection pool configuration. Default Prisma pool size is `num_physical_cpus * 2 + 1`. On Vercel serverless, each function gets its own Prisma instance, quickly exhausting PostgreSQL's default 100 max connections.

**Recommendation**: 
- Use Prisma Accelerate or PgBouncer for connection pooling
- Configure `?connection_limit=5&pool_timeout=10` in DATABASE_URL for serverless
- Add Prisma Data Proxy for edge deployments

---

### HIGH-07: Email Transport Created Per-Request

**Severity**: 🔴 HIGH  
**Component**: Performance / Reliability  
**File**: [mail.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/admin/mail.ts#L22-L27)

Every `sendAdminMail()` call creates a new SMTP transport via `nodemailer.createTransport()`. This opens a new TCP+TLS connection to the SMTP server per email.

**Recommendation**: Create a singleton transport:
```typescript
let transport: Transporter | null = null;
function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({ ... });
  }
  return transport;
}
```

---

### HIGH-08: Cron Secret Compared with `!==` (Timing Attack)

**Severity**: 🟡 HIGH  
**Component**: Security  
**File**: [release-stale-orders/route.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/app/api/cron/release-stale-orders/route.ts#L23)

`if (provided !== expected)` — direct string comparison of the CRON_SECRET. Allows timing-based secret extraction.

**Recommendation**: Use `timingSafeEqual` from `crypto`.

---

### HIGH-09: Seed Script `deleteMany({})` Destroys All Production Data

**Severity**: 🔴 HIGH  
**Component**: Database / Operations  
**File**: [seed.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/prisma/seed.ts#L38)

`await prisma.product.deleteMany({})`, `await prisma.patent.deleteMany({})`, `await prisma.teamMember.deleteMany({})` — the seed script wipes ALL existing products, patents, and team members before inserting demo data. Running this accidentally in production destroys the entire catalog.

**Recommendation**: 
- Add `if (process.env.NODE_ENV === 'production') throw new Error('Seed blocked in production')`
- Use upserts instead of delete+create
- Separate seed from migration

---

### HIGH-10: Customer Token Has 30-Day Expiry with No Refresh Mechanism

**Severity**: 🟡 HIGH  
**Component**: Security / Authentication  
**File**: [customer/auth.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/customer/auth.ts#L18)

The customer access token is set to expire in 30 days (`ACCESS_TOKEN_EXPIRY = "30d"`) with no refresh token rotation. If the token is compromised, the attacker has a month-long window.

**Recommendation**: Short-lived access tokens (15min–2h) + refresh token rotation, mirroring the admin auth pattern.

---

### HIGH-11: No Coupon Validation in Checkout Flow

**Severity**: 🟡 HIGH  
**Component**: Business Logic  
**Files**: [checkout/route.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/app/api/checkout/route.ts), [order.service.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/modules/shop/services/order.service.ts)

The `Coupon` model exists with active/expired/maxUses logic, but the checkout schema and `priceCart()` have zero coupon handling. Coupons can be created via admin but never applied.

**Recommendation**: Either remove the Coupon model or implement coupon validation in `priceCart()`.

---

### HIGH-12: `mrpInr` Stored as Integer Rupees, Converted to Paise with `* 100`

**Severity**: 🟡 HIGH  
**Component**: Business Logic / Data Integrity  
**File**: [order.service.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/modules/shop/services/order.service.ts#L64)

Product prices are stored as whole rupees (`mrpInr: 350`), then multiplied by 100 to get paise. This prevents prices like ₹349.50. The rest of the system uses `*Cents` naming (suggesting paise), creating naming confusion.

**Recommendation**: Store prices in paise throughout. Rename `mrpInr` to `pricePaise` or keep `mrpInr` as decimal. Be consistent with units.

---

### HIGH-13: Webhook Route Not in Middleware Matcher — Missing Rate Limiting

**Severity**: 🟡 HIGH  
**Component**: Security  
**File**: [middleware.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/middleware.ts#L230-L240)

`/api/webhooks/*` is NOT in the middleware matcher. While the webhook verifies signatures, it has no rate limiting. An attacker could flood the webhook endpoint with invalid payloads, causing excessive DB queries and logging.

**Recommendation**: Add `/api/webhooks/:path*` to the matcher with rate limiting.

---

### HIGH-14: No Pagination on Customer Portal Queries

**Severity**: 🟡 HIGH  
**Component**: Performance / Scalability  
**File**: [portal.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/lib/customer/portal.ts#L19-L27)

`getPortalOverview()` fetches ALL customer orders with no limit. `getCustomerOrders()` fetches ALL orders. `getCustomerDocuments()` fetches ALL orders with includes. A customer with 10,000 orders crashes the page.

**Recommendation**: Add cursor-based or offset pagination to all customer-facing queries.

---

## Medium Priority Issues

### MED-01: Inventory Low-Stock Filter Loads 2000 Rows Client-Side

**File**: [inventory.service.ts](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/src/modules/admin/services/inventory.service.ts#L452-L491)

When `lowOnly=true`, it fetches up to 2000 rows, maps them, then filters in JavaScript. This should be a database-level filter using a raw query: `WHERE "quantityOnHand" - "quantityReserved" <= "lowStockThreshold"`.

---

### MED-02: No Request Body Size Limit on API Routes

Checkout, newsletter, and portal OTP routes accept JSON bodies with no explicit size limit beyond Next.js defaults (1MB). A malicious payload of nested objects can cause CPU exhaustion during Zod parsing.

**Recommendation**: Add `export const config = { api: { bodyParser: { sizeLimit: '16kb' } } }` or check `Content-Length` in middleware.

---

### MED-03: No Error Boundary for 3D/Three.js Components

The homepage uses `@react-three/fiber` and `@react-three/drei` for 3D rendering. If WebGL is unavailable (corporate proxies, old hardware), the entire page crashes. No error boundary wraps the 3D scene.

**Recommendation**: Wrap 3D components in `<ErrorBoundary>` with a static fallback image.

---

### MED-04: `Product.images` Uses `String[]` Column Instead of Join Table

**File**: [schema.prisma](file:///c:/Users/Javeed%20Ahmad/Desktop/Cashmir%20Biotech/prisma/schema.prisma#L34)

`images String[] @default([])` — PostgreSQL array column. Cannot be indexed, queried, or independently managed. Adding metadata (alt text, sort order, dimensions) requires schema migration.

**Recommendation**: Create a `ProductImage` join table.

---

### MED-05: Missing `updatedAt` on `Expense`, `MediaAsset`, `InventoryTransaction`

Several models have `createdAt` but no `updatedAt`, making it impossible to track modifications for audit compliance.

---

### MED-06: `BlogPost.status` and `Patent.status` Are Free-Form Strings

These should be Prisma enums for type safety and query reliability. Currently any arbitrary string can be stored.

---

### MED-07: `Contact.email` Is Optional with No Unique Constraint

Two contacts can have the same email. Or null emails — making email-based deduplication impossible.

---

### MED-08: No CORS Configuration

No explicit CORS headers are set. While Next.js same-origin is default, the API has no programmatic CORS policy for potential future mobile app or third-party integrations.

---

### MED-09: `Order.shippingAddress` Is Untyped `Json?`

No Prisma-level validation. Corrupted or missing address fields cause runtime errors during invoice generation and shipping email.

**Recommendation**: Create a separate `OrderAddress` model or use Zod validation on read.

---

### MED-10: No Soft Delete Mechanism

Products, orders, customers — all use hard deletes or status flags inconsistently. No recoverability for accidental deletions.

---

## Low Priority Improvements

### LOW-01: Duplicate animation libraries — both `framer-motion` and `motion` packages
### LOW-02: `tailwind-merge` + `clsx` + `class-variance-authority` — three utility libs for class merging
### LOW-03: No `rel="noopener noreferrer"` audit on external links
### LOW-04: `SiteSettings` hard-coded to `id: 1` — single-tenant assumption baked into schema
### LOW-05: No favicon configuration or manifest.json for PWA
### LOW-06: `pino-pretty` is in `devDependencies` but no dev script uses it inline
### LOW-07: Empty `bio` for team member "Azmaan Shafi" has no avatar — visible gap on team page
### LOW-08: `robots.ts` disallows `/api` — correct, but also disallows `/admin` without password context

---

## Missing Features

| Feature | Status |
|---|---|
| Automated test suite | ❌ Missing |
| Coupon application at checkout | ❌ Missing |
| Wishlist functionality | ❌ Missing |
| Password reset flow (customer) | ❌ Missing |
| Product reviews/ratings | ❌ Missing |
| Search functionality (storefront) | ❌ Missing (only admin has search) |
| Bulk actions (admin orders) | ❌ Missing |
| Export functionality (customer invoices as PDF) | ❌ Missing |
| Email templates (HTML emails) | ❌ Missing (text-only emails) |
| Webhook retry mechanism | ❌ Missing |
| Health check endpoint | ❌ Missing |
| Structured logging correlation IDs | ❌ Missing |
| Database backup strategy | ❌ Missing |
| Monitoring / APM integration | ❌ Missing |
| Feature flags system | ❌ Missing |
| i18n / localization | ❌ Missing |
| Dark mode | ❌ Missing (colorScheme set to "light" only) |
| Stale session cleanup cron | ❌ Missing |
| Admin activity dashboard (real-time) | ❌ Missing |
| Customer email preferences | ❌ Missing |

---

## Architectural Improvements

1. **Extract Inventory to Its Own Service**: The inventory module is 505 lines and handles reservation, deduction, restoration, alerting, and reporting. It should be split into `InventoryReservationService`, `InventoryAdjustmentService`, and `InventoryReportingService`.

2. **Move Business Logic Out of Route Handlers**: The checkout route handler contains business logic (skip-payment check, Razorpay order creation). This should live in a `CheckoutService`.

3. **Implement Repository Pattern**: Direct `db.model.findMany()` calls are scattered across services, pages, and route handlers. A repository layer would centralize query logic and make testing possible.

4. **Event-Driven Order Lifecycle**: Order state transitions (`pending → paid → processing → shipped → delivered`) should use an event emitter or state machine pattern instead of ad-hoc `await markOrderPaid()` calls with manual side-effects.

5. **Separate Admin and Storefront Databases**: The single schema serves both admin CRM (contacts, deals, expenses) and storefront (orders, customers). At scale, these should be separate bounded contexts.

---

## Security Improvements

1. **Implement CSRF tokens** for all form submissions (not just Origin header check)
2. **Add request signing** for sensitive admin mutations
3. **Implement IP allowlisting** option for admin panel
4. **Add session invalidation** on password change (currently only 2FA toggle affects sessions)
5. **Implement account enumeration protection** consistently (customer OTP leaks account existence via different error messages)
6. **Add audit log for customer portal** actions (currently only admin actions are audited)
7. **Implement webhook IP allowlisting** for Razorpay IPs
8. **Add `Secure` flag** to all cookies unconditionally (not just in production)
9. **Remove dev-only PoW bypass** (`nonce === -1 && signature === "SKIP_DEV"`) from production builds

---

## Performance Improvements

1. **Implement query result caching** (Redis/Upstash) for product listings, patent pages, team page
2. **Add database query logging** in development to catch N+1 queries
3. **Lazy-load Three.js** — the 3D scene imports `three` (300KB+ gzipped) on the homepage
4. **Use `unstable_cache`** from Next.js for expensive DB queries in Server Components
5. **Add `loading.tsx`** skeletons for admin console pages
6. **Implement ISR** (Incremental Static Regeneration) for product and patent pages
7. **Bundle analysis** — `gsap` + `@react-three/fiber` + `framer-motion` + `motion` adds ~400KB to client bundle
8. **Image optimization** — products reference `/products/*.png` but no `<Image>` usage is verified
9. **Database indexes** — `Order.orderNumber` queries from checkout confirmation should hit the existing unique index, but `CustomerAddress.customerId + isDefault` composite index is missing

---

## Database Improvements

1. **Add composite index**: `CustomerAddress(customerId, isDefault)` — queried together for default address lookup
2. **Add index**: `Order(customerEmail)` — ✅ already exists
3. **Add index**: `CustomerOtp(email, purpose, usedAt)` — filtered together on every OTP verify
4. **Convert `BlogPost.status`** to enum: `draft | published | archived`
5. **Convert `Patent.status`** to enum or merge with `lifecycleStatus`
6. **Add `deletedAt` column** to `Product`, `Customer`, `Order` for soft deletes
7. **Add check constraint**: `Inventory.quantityOnHand >= 0`
8. **Add check constraint**: `Inventory.quantityReserved >= 0`
9. **Add check constraint**: `Order.totalCents >= 0`
10. **Add `orderNumber` index** to `Invoice` for cross-reference queries

---

## API Improvements

1. **Standardize error response format** — admin uses `{ error: { code, message } }`, public uses `{ ok: false, error: "string" }`. Pick one.
2. **Add API versioning** — `/api/v1/` prefix for future compatibility
3. **Add pagination metadata** — `{ data, meta: { page, pageSize, total, totalPages } }`
4. **Add OpenAPI/Swagger spec** — no API documentation exists
5. **Add request ID header** — `X-Request-Id` for correlation
6. **Rate limit all public API routes** — currently only specific routes are limited

---

## DevOps Improvements

1. **Add CI/CD pipeline** — no GitHub Actions, no deployment automation visible
2. **Add linting in CI** — ESLint is configured but not enforced pre-commit
3. **Add Dependabot** / Renovate for dependency updates
4. **Add database migration CI check** — ensure migrations are clean before merge
5. **Add staging environment** — no evidence of staging/preview deployments
6. **Add health check endpoint** (`/api/health`) checking DB connectivity
7. **Add structured log shipping** — Pino output should go to Datadog/Grafana/etc.
8. **Configure Vercel environment variables** — instead of `.env` file
9. **Add rollback strategy** — database migration rollback scripts

---

## Future Scaling Recommendations

1. **Read replicas** — Split read-heavy admin dashboard queries to replica
2. **CDN for uploads** — Cloudflare R2 + CDN for product images
3. **Queue-based order processing** — Bull/BullMQ for post-payment automation
4. **Separate admin API** — Extract admin panel as separate Next.js app
5. **Event sourcing for orders** — Replace mutable status with immutable event log
6. **Multi-region database** — PlanetScale or Neon for global latency
7. **Edge caching** — ISR + stale-while-revalidate for storefront pages
8. **WebSocket for admin** — Real-time order notifications instead of polling

---

## Code Refactoring Suggestions

1. **Deduplicate rate limiter factory functions** — All 5 functions in `rate-limit-edge.ts` follow identical pattern. Extract:
```typescript
function createRateLimiter(prefix: string, limit: number, window: string): Ratelimit | null { ... }
```

2. **Extract `applyDelta` from inventory service** — 500-line file should be split

3. **Remove `applyLegacyPepper` function** — it's literally `return password`. Remove after migration.

4. **Consolidate `framer-motion` and `motion` packages** — they're the same library at different versions

5. **Extract Zod schemas** to shared `validations/` directory — currently co-located in route handlers

6. **Remove unused spec/planning files from repo** — `bioinformatics-suite-technical-spec.md`, `implementation_instructions.md`, `frontend-code.txt`, `admin-logic-api-bundle.txt` are 700KB+ of non-code files in the repo root

---

## Production Readiness Checklist

| Item | Status |
|---|---|
| **Security** | |
| Secrets in environment variables (not files) | ⚠ Needs Improvement — `.env` exists with real creds |
| JWT secret is cryptographically random (≥256-bit) | ❌ Missing — uses placeholder string |
| Rate limiting on all public endpoints | ❌ Missing — disabled without Redis |
| CSRF protection | ⚠ Needs Improvement — Origin check only, no tokens |
| XSS protection via CSP | ❌ Missing — `unsafe-inline` + `unsafe-eval` |
| SQL injection protection | ✅ Complete — Prisma parameterized + tagged templates |
| File upload validation | ✅ Complete — Magic byte detection |
| Authentication system | ✅ Complete — JWE + JWT + session DB |
| Authorization / RBAC | ⚠ Needs Improvement — basic role check, no granular permissions |
| Session management | ✅ Complete — DB-backed, revocable, UA binding |
| 2FA for admin | ✅ Complete — Email OTP with timing-safe compare |
| **Infrastructure** | |
| Database connection pooling | ❌ Missing |
| File storage on object storage | ❌ Missing — local filesystem |
| Health check endpoint | ❌ Missing |
| Monitoring / alerting | ❌ Missing |
| Structured logging | ✅ Complete — Pino JSON |
| CI/CD pipeline | ❌ Missing |
| Staging environment | ❌ Missing |
| Backup strategy | ❌ Missing |
| **Code Quality** | |
| Test suite | ❌ Missing |
| Linting enforced | ⚠ Needs Improvement — config exists, not enforced |
| Type safety | ✅ Complete — TypeScript strict |
| Input validation | ✅ Complete — Zod on all public endpoints |
| Error handling | ⚠ Needs Improvement — inconsistent patterns |
| **Business Logic** | |
| Transactional order creation | ❌ Missing — race condition |
| Idempotent payment processing | ✅ Complete |
| Inventory management | ✅ Complete — atomic reservations |
| Invoice generation | ✅ Complete |
| Order lifecycle | ✅ Complete |
| Email notifications | ⚠ Needs Improvement — text only, SMTP per-request |
| **SEO & Performance** | |
| Meta tags | ✅ Complete |
| Sitemap | ✅ Complete |
| robots.txt | ✅ Complete |
| Image optimization | ⚠ Needs Improvement — no `<Image>` verification |
| Bundle optimization | ❌ Missing — 3D + animation libraries unoptimized |
| **Accessibility** | |
| ARIA labels | ❌ Missing — not audited |
| Keyboard navigation | ❌ Missing — not audited |
| Screen reader support | ❌ Missing — not audited |
| Color contrast compliance | ❌ Missing — not audited |

---

## Top 100 Improvements (Ranked by Impact)

| # | Improvement | Severity | Category |
|---|---|---|---|
| 1 | Rotate all secrets, use cryptographically random JWT_SECRET | Critical | Security |
| 2 | Wrap order creation + stock reservation in a single DB transaction | Critical | Data Integrity |
| 3 | Move file uploads to cloud object storage (Vercel Blob/S3/R2) | Critical | Infrastructure |
| 4 | Make rate limiting mandatory in production (fail-closed) | Critical | Security |
| 5 | Fix customer OTP timing-safe comparison | Critical | Security |
| 6 | Move PoW challenge tracking to Redis | Critical | Security |
| 7 | Add automated test suite (Vitest + Playwright) | High | Quality |
| 8 | Remove `unsafe-inline` and `unsafe-eval` from CSP | High | Security |
| 9 | Add database connection pooling for serverless | High | Scalability |
| 10 | Protect seed script from running in production | High | Operations |
| 11 | Add customer portal middleware auth check | High | Security |
| 12 | Remove `CHECKOUT_SKIP_PAYMENT` from `.env` and `NEXT_PUBLIC_` | High | Security |
| 13 | Shorten customer token lifetime + add refresh rotation | High | Security |
| 14 | Add CRON_SECRET timing-safe comparison | High | Security |
| 15 | Consolidate duplicate security headers | High | Maintenance |
| 16 | Implement coupon validation in checkout or remove model | High | Business Logic |
| 17 | Decouple webhook from middleware for rate limiting | High | Security |
| 18 | Add pagination to all customer portal queries | High | Performance |
| 19 | Create SMTP transport singleton | High | Performance |
| 20 | Add CI/CD pipeline (GitHub Actions) | High | DevOps |
| 21 | Implement health check endpoint | Medium | Operations |
| 22 | Add ISR for product/patent pages | Medium | Performance |
| 23 | Fix inventory low-stock filter to use DB query | Medium | Performance |
| 24 | Convert string status fields to enums | Medium | Type Safety |
| 25 | Add ErrorBoundary for Three.js components | Medium | Reliability |
| 26 | Implement request body size limits | Medium | Security |
| 27 | Add request ID correlation to logs | Medium | Observability |
| 28 | Create `ProductImage` join table | Medium | Schema Design |
| 29 | Standardize API error response format | Medium | API Design |
| 30 | Add soft delete mechanism | Medium | Data Safety |
| 31 | Add `updatedAt` to missing models | Medium | Audit |
| 32 | Add unique constraint to `Contact.email` | Medium | Data Integrity |
| 33 | Type `Order.shippingAddress` properly | Medium | Type Safety |
| 34 | Implement proper CORS policy | Medium | Security |
| 35 | Add OpenAPI documentation | Medium | Developer Experience |
| 36 | Add database check constraints | Medium | Data Integrity |
| 37 | Lazy-load Three.js scene | Medium | Performance |
| 38 | Implement client-side form validation feedback | Medium | UX |
| 39 | Add loading skeletons to admin pages | Medium | UX |
| 40 | Remove dev-only PoW bypass from production builds | Medium | Security |
| 41 | Implement structured error classes for all domains | Medium | Code Quality |
| 42 | Add audit logging for customer portal actions | Medium | Compliance |
| 43 | Add webhook IP allowlisting | Medium | Security |
| 44 | Add Dependabot configuration | Medium | Maintenance |
| 45 | Add pre-commit hooks (husky + lint-staged) | Medium | Quality |
| 46 | Implement password reset flow for customers | Medium | Feature |
| 47 | Add storefront search functionality | Medium | Feature |
| 48 | Implement bulk actions for admin orders | Medium | Feature |
| 49 | Add customer invoice PDF download | Medium | Feature |
| 50 | Implement HTML email templates | Medium | Feature |
| 51 | Deduplicate rate limiter factory functions | Low | Code Quality |
| 52 | Split 505-line inventory service | Low | Maintainability |
| 53 | Remove `applyLegacyPepper` after migration | Low | Cleanup |
| 54 | Consolidate `framer-motion` + `motion` packages | Low | Dependencies |
| 55 | Extract Zod schemas to shared directory | Low | Organization |
| 56 | Remove 700KB+ of planning docs from repo root | Low | Cleanup |
| 57 | Add API versioning (`/api/v1/`) | Low | API Design |
| 58 | Add database migration CI validation | Low | DevOps |
| 59 | Add staging environment | Low | DevOps |
| 60 | Add rollback scripts for migrations | Low | DevOps |
| 61 | Implement event-driven order lifecycle | Low | Architecture |
| 62 | Extract CheckoutService from route handler | Low | Architecture |
| 63 | Implement repository pattern | Low | Architecture |
| 64 | Add composite index on `CustomerAddress(customerId, isDefault)` | Low | Performance |
| 65 | Add composite index on `CustomerOtp(email, purpose, usedAt)` | Low | Performance |
| 66 | Configure Next.js `<Image>` for all product images | Low | Performance |
| 67 | Run bundle analyzer and tree-shake unused code | Low | Performance |
| 68 | Add `rel="noopener"` audit on external links | Low | Security |
| 69 | Add favicon + manifest.json for PWA | Low | UX |
| 70 | Fix empty avatar for team member "Azmaan Shafi" | Low | Content |
| 71 | Add dark mode support | Low | UX |
| 72 | ARIA label audit across all pages | Low | Accessibility |
| 73 | Keyboard navigation audit | Low | Accessibility |
| 74 | Color contrast WCAG 2.1 AA audit | Low | Accessibility |
| 75 | Screen reader testing | Low | Accessibility |
| 76 | Add stale session cleanup cron job | Low | Maintenance |
| 77 | Add real-time admin notifications (WebSocket) | Low | Feature |
| 78 | Add customer email preferences | Low | Feature |
| 79 | Add wishlist functionality | Low | Feature |
| 80 | Add product reviews/ratings | Low | Feature |
| 81 | Add webhook retry mechanism | Low | Reliability |
| 82 | Add feature flags system | Low | Architecture |
| 83 | Add i18n/localization support | Low | Feature |
| 84 | Implement read replicas for admin dashboard | Low | Scalability |
| 85 | Add CDN configuration for uploads | Low | Performance |
| 86 | Implement queue-based order processing | Low | Architecture |
| 87 | Separate admin as standalone app | Low | Architecture |
| 88 | Add event sourcing for orders | Low | Architecture |
| 89 | Add multi-region database support | Low | Scalability |
| 90 | Add edge caching strategy | Low | Performance |
| 91 | Add structured log shipping to observability platform | Low | Operations |
| 92 | Implement session invalidation on password change | Low | Security |
| 93 | Store prices in paise throughout (rename `mrpInr`) | Low | Consistency |
| 94 | Add pagination metadata to all list endpoints | Low | API Design |
| 95 | Add `SiteSettings` multi-tenant support | Low | Architecture |
| 96 | Add database backup automation | Low | Operations |
| 97 | Implement monitoring/APM (Datadog/Grafana) | Low | Operations |
| 98 | Add content versioning for CMS | Low | Feature |
| 99 | Performance test with k6/Artillery at 1000 RPS | Low | Quality |
| 100 | Security penetration test by third party | Low | Security |
