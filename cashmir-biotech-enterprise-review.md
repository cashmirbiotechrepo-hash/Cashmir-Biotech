# Cashmir Biotech — Enterprise Software Review Board Report

**Panel:** Architecture · Full-stack · Frontend · Backend · Database · DevOps · Cloud · Security · AppSec · SRE · Performance · Product Design · UI/UX · Accessibility · QA · API · Business Analysis · Product · Solutions Architecture  
**Scope:** Entire product (storefront, admin, Research Portal, APIs, Prisma, ops)  
**Theme policy:** Light-only — dark mode ignored per brief  
**Date:** 14 July 2026  
**Decision (original):** **REJECT** for large / enterprise production until Critical issues are closed  
**Remediation (14 Jul 2026 · pass 5):** R1–R8 closed — CSP nonces, Sentry SDK, money-path E2E, Research Circle, InventoryLot provenance, org invites, DB money CHECKs + unique `razorpayOrderId`, production pooled `DATABASE_URL` fail-closed. Ops leftovers: live Sentry DSN (R9), Circle renewals (R10).

Interactive scorecard: open the canvas beside chat (enterprise-review-board).

---

## Remediation status

| ID | Status | Notes |
|----|--------|-------|
| C1–C4 | Fixed | Invoice wire, confirmation token, verify fail-closed, encryption fail-closed |
| C5 | Fixed | GST + packing PDFs; Blob/local persist on pay; CoA upload + portal |
| C6 | Fixed | Full + partial refunds, `partially_refunded` status, portal refund display |
| H1–H10 | Fixed | Atomic stock, PII token, tools RL, coupons, OTP, RBAC, cron, tests, inventory SoT, skip-pay via `featureEnabled` |
| Medium | Fixed | CSRF, logout POST + Edge denylist on logout, cron Bearer, refresh, optional `CUSTOMER_JWT_SECRET`, unique invoice, addresses, contact, search, Edge revoke |
| Low | Fixed | Mobile nav, attempt disclosure, crypto SKU, login redirect |
| §20 | Fixed | Categories admin, B2B org+quotes+PO/GSTIN, support admin console, Playwright smoke (`npm run test:e2e`), packing docs, OTP lookup |
| Residual R1–R8 | Fixed | CSP · Sentry SDK · money-path E2E · Circle · lots · org invites · DB money CHECKs · pooled URL fail-closed |
| Residual | Ops | Live Sentry DSN (R9); Circle Razorpay renewals (R10) |

---

## 1. Executive Summary

This is a polished marketing and checkout *surface* wrapped around a commerce core that was **not production-correct** at review time. The Critical money-path breakers below have since been remediated in-repo (see Remediation status).

Relative strengths exist: admin vs customer session separation, server-priced carts, Razorpay webhook HMAC, admin PoW/lockout/2FA patterns, and a coherent Research Portal product direction.

**Original blockers (now fixed unless marked Partial):**

1. `markOrderPaid` dynamically imports `@/modules/shop/services/invoice.service` — **file does not exist** → Fixed  
2. Order confirmation imports `getOrderSummaryByNumber` — **function does not exist** → Fixed  
3. `POST /api/payment/verify` calls `markOrderFailed` on invalid signatures — attacker can release reserved stock → Fixed  
4. Edge decrypt falls back to a **hardcoded** `DEV_ENCRYPTION_KEY` when `ENCRYPTION_KEY` is unset → Fixed  
5. Customer “invoices / documents” and “refunds” are mostly UI/mailto theatre — no GST PDF pipeline, no Razorpay reverse → Refunds fixed; GST binary PDF / CoA still Partial  

An Enterprise Review Board would still require binary invoice/CoA, inventory model consolidation, and E2E before full institutional go-live.

---

## 2–14. Scores (/100)

| Area | Score | Rationale (short) |
|------|------:|-------------------|
| **Overall** | **41** | Foundations without a trustworthy money path |
| **Production readiness** | **27** | Broken post-pay + missing confirmation lookup |
| **Enterprise readiness** | **22** | No PDF, CoA, B2B profile, org accounts, refund ledger |
| **Architecture** | **56** | Clear route groups; commerce atomicity gaps |
| **Security** | **47** | Good session design; several High AppSec findings |
| **Performance** | **54** | Fine at low traffic; tools/unpooled DB risk |
| **Scalability** | **33** | Serverless + non-atomic stock + CPU tools |
| **Maintainability** | **51** | Spec dumps + dual invoice paths + dead imports |
| **UI/UX** | **61** | Brand strong; post-purchase incomplete |
| **Accessibility** | **46** | Some alerts; portal OTP / addresses weak |
| **Code quality** | **53** | Uneven; critical dead/missing modules |
| **Developer experience** | **49** | CI exists; failing symbols should fail louder |
| **Business logic** | **38** | Coupons, stock, refunds, invoice races |

---

## 15. Risk Assessment

| Risk | Likelihood | Impact | Notes |
|------|------------|--------|-------|
| Paid order path throws after capture | High | Critical | Missing `invoice.service` |
| Oversell via verify abuse | Medium | Critical | Fail-on-bad-signature |
| PII scrape via order URLs | Medium | High | Capability URL |
| Session crypto with known key | Low–Med | Critical | Only if Edge env misconfigured |
| Tools CPU burn | High if exposed | High | Outside middleware matcher |
| Finance / GST non-compliance | High | Critical | No customer PDF |
| Refund disputes | High | High | Status-only refunds |

**Residual risk after “Critical” fixes only:** still High until atomic inventory + PDFs + refunds + E2E tests.

---

## 16. Critical Issues

### C1 — Paid flow imports missing `invoice.service`
- **Severity:** Critical  
- **Location:** `src/modules/shop/services/order.service.ts` (`generateInvoiceForOrder` dynamic import)  
- **Description:** Module path has no file. `ensureInvoiceForOrder` already exists in `order-ops.service.ts`.  
- **Why:** Post-payment automation can crash after money moves.  
- **Impact:** Paid customers without invoices; ops blind; possible partial side effects.  
- **Reproduce:** Complete Razorpay pay or `CHECKOUT_SKIP_PAYMENT` → `markOrderPaid`.  
- **Fix:** Call `ensureInvoiceForOrder` (and `runPaidOrderAutomation`); delete dead import.  
- **Enterprise:** Idempotent invoice in same transactional boundary as paid transition; emit outbox event for PDF worker.  
- **Priority:** P0 · **Effort:** 2h  

### C2 — Missing `getOrderSummaryByNumber`
- **Severity:** Critical  
- **Location:** `src/app/(public)/order/[orderNumber]/page.tsx`  
- **Description:** Import has no export in `order.service.ts`.  
- **Why:** Confirmation journey is broken or typecheck-inconsistent.  
- **Impact:** Support load; abandoned trust after pay.  
- **Fix:** Restore function **and** authorize via checkout secret (≥128-bit), not bare order number.  
- **Priority:** P0 · **Effort:** 1d  

### C3 — Invalid verify fails pending orders
- **Severity:** Critical  
- **Location:** `src/app/api/payment/verify/route.ts` L52–58  
- **Description:** Bad signature → `markOrderFailed` (releases reservation).  
- **Why:** Client-supplied `razorpayOrderId` + garbage signature is enough.  
- **Impact:** Race with webhook → oversell / chaotic states.  
- **Reproduce:** `POST /api/payment/verify` with victim order id + invalid signature.  
- **Fix:** Log + 400 only; never mutate order on invalid verify.  
- **Priority:** P0 · **Effort:** 1h  

### C4 — Edge encryption hardcoded fallback
- **Severity:** Critical (conditional on misconfig)  
- **Location:** `src/lib/admin/encryption-edge.ts`  
- **Description:** `ENCRYPTION_KEY ?? DEV_ENCRYPTION_KEY` with known 32-char string — **no NODE_ENV guard**.  
- **Why:** Session JWE may be decryptable by anyone who knows the public string.  
- **Fix:** Fail closed if unset; never ship the string in Edge bundles for prod builds.  
- **Priority:** P0 · **Effort:** 1h  

### C5 — No real invoice / CoA PDF pipeline
- **Severity:** Critical (enterprise)  
- **Location:** `Invoice.pdfUrl`, portal Documents  
- **Description:** UI promises download; PDF not generated for customers.  
- **Impact:** Labs/universities cannot account for purchases.  
- **Fix:** PDF worker (GST template) + Blob storage + portal links; CoA upload on lot/batch.  
- **Priority:** P0 · **Effort:** 3–5d  

### C6 — Refunds are status-only
- **Severity:** Critical (enterprise / finance)  
- **Location:** Admin order status; portal Support mailto  
- **Description:** No Razorpay refund API, amounts, reasons, or customer-facing state machine.  
- **Impact:** Chargebacks, GST chaos, support hell.  
- **Fix:** Refund API + ledger + portal status + inventory restock policy.  
- **Priority:** P0 · **Effort:** 3–5d  

---

## 17. High Priority Issues

| ID | Title | Location | Effort |
|----|-------|----------|--------|
| H1 | Stock reserve outside DB transaction | `createPendingOrder` / inventory service | 1–2d |
| H2 | Public order URL PII | `/order/[orderNumber]` | 1d |
| H3 | `/api/tools/*` not in middleware matcher | `middleware.ts` | 2h |
| H4 | Coupon `usedCount` on pending | checkout create | 4h |
| H5 | OTP cooldown email enumeration | `lib/customer/auth.ts` | 2h |
| H6 | Incomplete RBAC on order/coupon writes | admin actions / coupons API | 4h |
| H7 | cleanup-sessions uses `used` not `usedAt` | cron route | 2h |
| H8 | No money-path automated tests | vitest suite | 3d |
| H9 | Dual stock: `Product.stockQty` + `Inventory` | schema + services | 2d |
| H10 | `CHECKOUT_SKIP_PAYMENT` dual flag | checkout route | 1h (guard + alert) |

---

## 18. Medium Priority Issues

- Newsletter CSRF origin not in middleware origin block  
- Admin logout via GET (logout CSRF)  
- Cron secret accepted via query string  
- Customer refresh cookie path with **no** refresh route  
- Shared `JWT_SECRET` for admin + customer (mitigated by audience)  
- Invoice `orderId` not unique — race → dual invoices  
- Portal address form silent fail on Zod error  
- Portal missing loading/error boundaries  
- Checkout does not reuse portal saved addresses  
- Contact page mailto-only (no ticket)  
- CSP `script-src 'unsafe-inline'`  
- Middleware JWT without DB revoke check at edge  

---

## 19. Low Priority Improvements

- Blog empty published-posts state  
- Portal Addresses/Security buried on mobile  
- Remaining-attempt disclosure on admin login  
- Non-crypto `Math.random` SKU suffixes  
- Dead portal login redirect branch in middleware  
- Spec dump files (`frontend-code.txt`, huge `implementation_instructions.md`) cluttering repo  

---

## 20. Missing Features

- GST PDF + packing docs for customers  
- CoA / lot / batch certificates  
- Razorpay refunds + partial refunds  
- Product search / filter / sort  
- B2B: org GSTIN, PO number, multi-user org  
- Guest order lookup (email + order + OTP)  
- In-app support tickets  
- Forgot/set password UX or remove passwordHash residue  
- Email verification *product* journey (beyond OTP flag)  
- Session revoke per device  
- Categories / collections model  
- Quotes / institutional pricing  
- Real subscription / Research Circle (specced, not built)  
- Observability (Sentry/OTel) wired  
- Feature flags for payment skip / PoW  

---

## 21. Missing Edge Cases

- Verify invalid while webhook succeeds  
- Double-pay / partial capture  
- Coupon deleted mid-checkout  
- Stock 0 after reserve expired  
- Concurrent OTP verify  
- Order number collision (unlikely but unproven uniqueness load)  
- Soft-fail SMTP during OTP → silent “success” confusion  
- Admin session revoke while Edge still accepts JWT  
- Razorpay downtime after pending create  
- International address / phone formats  

---

## 22. Missing Validation

- Portal address: no India PIN autofill parity with checkout; silent server reject  
- Money ≥ 0 DB constraints  
- `razorpayOrderId` uniqueness when non-empty  
- Tools API body under middleware rate limit  
- Inventory SKU uniqueness  
- Contact email uniqueness for CRM  

---

## 23. Architectural Improvements

1. Single commerce bounded context: Order + Inventory + Payment outbox  
2. Remove dual invoice entrypoints; one service  
3. Domain events (`OrderPaid`, `InvoiceReady`) → workers  
4. Separate secrets for admin vs customer JWTs  
5. Connection pooler mandatory for serverless Prisma  
6. Move CPU tools to queued workers or separate service  
7. Stop co-mingling large “bundle” txt dumps with application code  

---

## 24. UI Improvements

- Confirmation: trust checklist + portal CTA (already directionally right) only after data API works  
- Shop: search + filters  
- Portal Documents: honest empty state (“PDF generating…”) vs fake Download  
- Portal support: ticket status vs mailto wall  
- Admin refund panel with amount/reason  
- Unify form primitives between checkout and portal addresses  
- Focus: `aria-describedby` on checkout + portal OTP `role="alert"`  

---

## 25. Backend Improvements

- Fix `markOrderPaid` automation chain  
- Verify endpoint state machine  
- Coupon lifecycle  
- Attach customer + link guest orders only when verified (already partly done — re-audit after invoice fix)  
- Admin RBAC matrix on all mutations  
- Remove GET logout  

---

## 26. Database Improvements

- `@@unique([orderId])` on Invoice (nullable-safe strategy)  
- Unique SKUs  
- CHECK non-negative money  
- Soft-delete policy consistency  
- Index review for order list filters  
- Outbox table for emails/PDF jobs  

---

## 27. API Improvements

- Version public APIs or freeze contracts (`/api/v1/...`)  
- Consistent error `{ ok, error: { code, message } }`  
- Put tools + health security headers under matcher  
- Portal refresh route or remove cookie  
- Paginate all admin list APIs  

---

## 28. Security Improvements

P0–P1 from Critical/High above, plus:

- Nonce-based CSP  
- Order confirmation secrets  
- Uniform OTP responses  
- Separate ENCRYPTION keys per context  
- Penetration test on checkout + portal  
- Dependency scanning gate beyond Dependabot PRs  

---

## 29. Performance Improvements

- Image strategy beyond Unsplash remotePatterns (own product CDN)  
- Avoid full-reload Fast Refresh hotspots in admin during large form trees  
- Cache product catalog with revalidation tags  
- Cap BLAST/align concurrency  
- Prisma read replicas later (not before correctness)  

---

## 30. DevOps Improvements

- Startup fail if Critical env missing (Razorpay, ENCRYPTION_KEY, CRON_SECRET)  
- Alerting on `markOrderPaid` failures  
- Staging with payment sandbox + load smoke  
- Backup/restore runbook for Postgres  
- Deny query-param cron auth in production  
- Fix nightly cleanup cron  

---

## 31. Testing Improvements

Minimum bar before paid traffic:

1. Unit: signature verify does **not** fail orders  
2. Integration: reserve → pay → invoice idemptotent  
3. Integration: webhook + verify race  
4. E2E: guest checkout → confirmation token → portal OTP → order visible  
5. Load: inventory under concurrency  

Current: **4** unit files — unacceptable for money systems.

---

## 32. Scalability Improvements

- PgBouncer  
- Redis rate limits (already required) — multi-region awareness  
- Idempotent workers for PDF/email  
- Horizontal-safe session store (already DB) — keep Edge auth cheap  
- Queue for tools  

---

## 33. Technical Debt

- Missing symbols already imported  
- Dual stock quantities  
- Spec/markdown sprawl in root  
- Customer passwordHash unused  
- Customer refresh unimplemented  
- Admin legacy content redirects  
- CSP/security headers only on matcher subset  

---

## 34. Refactoring Opportunities

- Extract `CommercePaymentService` with explicit state machine  
- Shared `FormField` with a11y across shop/portal  
- Collapse order-ops + invoice into one module  
- Centralize rate-limit + CSRF policy table (single source)  

---

## 35. Future Enhancements (after P0)

- Research Circle / subscriptions  
- Authenticity QR / batch provenance (brand differentiator — build only when docs pipeline exists)  
- Institutional SSO / org seats  
- Multi-warehouse inventory  
- Full GST e-invoice integration (India)  

---

## 36. Production Readiness Checklist

| Check | Status |
|-------|--------|
| Money path compiles and runs | ❌ |
| Confirmation page works securely | ❌ |
| Inventory atomic under concurrency | ❌ |
| Invoices downloadable | ❌ |
| Refunds reversible at gateway | ❌ |
| ENCRYPTION_KEY fail-closed on Edge | ❌ |
| Tools rate-limited | ❌ |
| Observability on payments | ❌ |
| E2E money tests in CI | ❌ |
| Secrets not in repo | ✅ (.env ignored; MCP.json should stay out) |
| Admin/customer session separation | ✅ |
| Webhook signature verify | ✅ |
| Server-priced cart | ✅ |
| Light theme intentional | ✅ (N/A dark) |

---

## 37. Top 100 Improvements Ranked by Impact

1. Wire `markOrderPaid` → `ensureInvoiceForOrder`  
2. Restore + secure `getOrderSummaryByNumber`  
3. Stop failing orders on bad verify signatures  
4. Edge: no DEV encryption fallback  
5. GST PDF generation + Blob + `pdfUrl`  
6. Razorpay refunds + UI + customer status  
7. Transactional inventory reserve/deduct  
8. Middleware match + rate-limit `/api/tools`  
9. Coupon accounting on paid/abandon  
10. Uniform portal OTP responses  
11. PgBouncer / pool limits  
12. RBAC on order/coupon/CRM writes  
13. Fix cleanup-sessions schema  
14. Bearer-only CRON_SECRET  
15. Unique invoice per order  
16. E2E checkout→webhook→portal  
17. Catalog search/filter  
18. CoA/batch attachment  
19. CSP nonces  
20. Sentry/OTel + payment alerts  
21. Checkout ↔ saved addresses  
22. Order confirmation ≥128-bit token  
23. Dual stock consolidation  
24. Money CHECK constraints  
25. Startup env fail-fast  
26. Remove GET admin logout  
27. Newsletter origin CSRF  
28. Portal loading/error boundaries  
29. Portal address error UX  
30. Session device revoke  
31. Customer profile / GSTIN  
32. Guest order lookup  
33. Contact inquiry form  
34. Partial refunds  
35. Inventory restock on refund  
36. Idempotent email outbox  
37. PDF async worker  
38. Tools job queue  
39. Separate admin/customer JWT secrets  
40. Encrypt admin refresh cookie  
41. Implement or drop customer refresh  
42. Unique Inventory/Product SKU  
43. Contact email unique  
44. razorpayOrderId unique when set  
45. Soft-delete policy doc + implement  
46. Admin bulk order actions  
47. Support ticket entity  
48. Refund reason taxonomy  
49. Ship-delay notifications in portal  
50. Rate-limit BLAST harder  
51. Image CDN for product assets  
52. Catalog tag revalidation  
53. Read replica (later)  
54. Feature flags for skip-payment  
55. Kill `ALLOW_CHECKOUT_SKIP_IN_PRODUCTION` outside break-glass  
56. Pen-test checkout/portal  
57. Dependency SLA on Dependabot  
58. Load test inventory  
59. Chaos: Razorpay 500s  
60. Backup restore drill  
61. Runbook: stale order cron  
62. Audit export access review  
63. Finance reconciliation report  
64. GSTIN validation  
65. India state/PIN shared component  
66. aria-describedby checkout  
67. Portal OTP aria-live  
68. Keyboard delivery option radios  
69. Reduce motion audits beyond nav  
70. Mobile portal Addresses nav  
71. Honest Documents empty states  
72. Admin refund print/credit note  
73. Packing slip ↔ inventory lots  
74. Lot expiry on product  
75. Authenticity QR (phase 2)  
76. Patent docs deep-link from order  
77. Research feed (phase 2)  
78. Research Circle loyalty (phase 2)  
79. Org multi-seat (phase 2)  
80. Quote/PO workflow (phase 2)  
81. API versioning  
82. OpenAPI for admin APIs  
83. Contract tests webhooks  
84. Playwright CI smoke  
85. Visual regression shop  
86. a11y CI (axe)  
87. Remove root bundle txt clutter  
88. ADR docs for commerce  
89. Error code taxonomy  
90. Structured logging correlation IDs  
91. Slack/PagerDuty on paid failures  
92. Staging seed dataset  
93. Synthetic checkout canary  
94. WAF rate rules for tools  
95. Bot protection on portal OTP  
96. Honeypot on newsletter  
97. Content moderation for contact forms  
98. Legal: terms/privacy acceptance at checkout  
99. Cookie consent if required by jurisdiction  
100. Quarterly enterprise review repeat  

---

## Issue template (for tracker)

For any item above, file as:

```
Title / Severity / Location / Description / Why / Impact / Reproduce / Solution / Enterprise pattern / Priority / Effort
```

---

## Final board statement

**Do not confuse aesthetic quality with correctness.** The public brand is ahead of the ledger. Until the money path compiles, inventory is atomic, invoices are real PDFs, and refunds reverse payments, this product is a **demo-grade commerce shell**, not an enterprise biotech storefront.

**Gate:** Close C1–C6 + H1–H3 + money-path E2E in CI before accepting paid production traffic beyond private beta.
