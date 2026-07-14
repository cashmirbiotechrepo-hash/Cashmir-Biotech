# Cashmir Biotech — Production Readiness Report

**Date:** 14 July 2026  
**Phase:** Final production hardening  
**Scope:** Full platform (storefront, checkout/payments, Customer Portal, Operations Console, bioinformatics suite, APIs, Prisma, CI/ops)

---

## Final score: **88 / 100**

Not 100: live Sentry DSN, private Blob URLs for invoices/CoA, Research Circle renewals, and containerized deploy docs remain manual or follow-on work. All identified Critical money-path and payment-skip footguns found in this pass are addressed in code.

---

## Executive verdict

The platform is **ready to deploy to real users** once Vercel Production env vars are set (see blockers). Core commerce, auth, inventory claim, and admin/customer portals fail closed under production misconfiguration. Residual gaps are ops configuration and a few medium-priority architecture upgrades (private blobs, Circle billing renewals).

---

## Issues found and fixed (this hardening pass)

### Critical

| Issue | Why it mattered | Fix |
|-------|-----------------|-----|
| Dual verify+webhook could double-deduct stock / double-burn coupons | Concurrent fulfillment corrupts inventory and coupon caps | Atomic SQL claim in `markOrderPaid` (`UPDATE … WHERE status IN ('pending','payment_failed') RETURNING`) |
| Verify returned success when fulfillment failed | Customer believes order complete while DB/stock broken | Verify/webhook propagate `paid.ok`; return 500 / `needsSupport` so Razorpay retries |
| Production free checkout via `ALLOW_CHECKOUT_SKIP_IN_PRODUCTION` | One bad env → ₹0 “paid” orders | Hard-disable skip when `NODE_ENV` or `VERCEL_ENV` is production; flag removed from feature path |
| Packing/invoice PDFs available with pre-pay confirmation token | Abandoned checkout leak of ship-to PII | `getOrderInvoiceByToken` requires paid/post-paid statuses |
| `reset-admin` shipped default password | Break-glass script could set known creds | Require `ADMIN_RESET_PASSWORD`; refuse prod DB unless `ALLOW_PROD_ADMIN_RESET=yes` |

### High

| Issue | Why it mattered | Fix |
|-------|-----------------|-----|
| Coupon `maxUses` not enforced at burn / percent unbounded | Concurrent checkout exceeds caps; 500% coupons | Conditional SQL burn; percent capped at 100 in schema + pricing |
| No Razorpay Payments API amount check on verify | Weaker ledger integrity | `assertCapturedPayment` after HMAC |
| `payment.failed` released stock before late capture | Oversell / failed paid fulfillment | Fail path keeps reservation; cron releases stale holds (pending + payment_failed) |
| Guest order lookup / payment verify unthrottled | OTP email flood / abuse | Edge rate limits for `/api/order/lookup` and `/api/payment/verify` |
| Tools API CORS defaulted to `*` | Cross-origin tool abuse in prod | Fail closed unless `ALLOWED_ORIGINS` allowlist |
| Org invites fell back to localhost | Broken invite links in prod | Require site URL in production path |
| Portal OTP silently “succeeds” without SMTP in prod | Users never receive codes | Fail closed when SMTP missing on live/preview |
| Public `/api/health` leaked uptime/version/DB latency | Recon for attackers | Minimal `{ status }` publicly; detail behind `CRON_SECRET` |
| Missing `global-error.tsx` | Root layout crashes unhandled | Added root crash boundary with Sentry |
| CI build missing encryption/cron secrets | Flaky / false CI | Added CI env for Encrypt/Cron/Site URL/Razorpay stubs |

### Medium / ops

| Issue | Fix |
|-------|-----|
| Env schema incomplete for live deploy | Extended `env.server.ts` + instrumentation fail-fast for Upstash/Razorpay/SMTP |
| E2E fixture on non-`production` Node with live DB | Also gated on `VERCEL_ENV !== production` |
| Playwright artifacts untracked risk | `test-results/`, `playwright-report/` gitignored |
| Admin login listed fictional modules | Aligned with real console routes |
| Research Circle honored caller `skipPayment` | Only via hard-fail-closed feature flag |

---

## Remaining blockers (manual / follow-on)

These require human ops or larger product work — **not silently mergeable**:

1. **Set Vercel Production secrets** — `DATABASE_URL` (pooled), `JWT_SECRET`, `ENCRYPTION_KEY`, `PASSWORD_PEPPER`, `CRON_SECRET`, `POW_SECRET`, Upstash pair, Razorpay trio, SMTP, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_SITE_URL`, Sentry DSN. **Unset:** `CHECKOUT_SKIP_PAYMENT`, `NEXT_PUBLIC_CHECKOUT_SKIP_PAYMENT`, `E2E_HOOKS_ENABLED`, `DISABLE_POW`.
2. **Live Sentry DSN (R9)** — SDK is wired; production visibility needs real DSN.
3. **Private Blob / signed URLs for invoices & CoA** — currently public Blob ACLs; migrate to private + short-lived URLs or authenticated proxy.
4. **Research Circle recurring renewals (R10)** — subscription product incomplete for automated renewals.
5. **Optional Dockerfile** — not required for Vercel; needed only for self-hosted containers.
6. **Admin 2FA enforcement policy** — still optional per-admin; recommend requiring 2FA for `owner`/`admin` roles in production (product decision).
7. **Partial unique index on `razorpayPaymentId WHERE <> ''`** — deferred schema migration.

---

## Area scores (post-hardening)

| Area | Score | Notes |
|------|------:|-------|
| Production readiness | 88 | Env + money path hardened; ops secrets remain |
| Security | 86 | Skip-pay closed, rate limits, CORS, paid document gate |
| Money path | 90 | Atomic claim + assert capture + fulfillment signals |
| Reliability | 84 | Webhook retry on fulfillment fail; health trimmed |
| Customer Portal | 82 | Framing fixed earlier; SMTP fail-closed |
| Operations Console | 84 | Enterprise login; command-center dashboard still aspirational |
| Bioinformatics suite | 78 | Live tools solid; “coming soon” sections intentional |
| Ops / observability | 72 | Sentry wired; DSN + alerts manual |
| Accessibility | 70 | Prior gaps; not deep-retested this pass |
| Maintainability | 80 | Env fail-fast; scripts safer |

---

## Deploy preflight checklist

- [ ] Pooled `DATABASE_URL` verified (`assertProductionDatabasePooling`)
- [ ] All live-deploy secrets present (instrumentation throws if missing)
- [ ] Razorpay webhook endpoint live + secret match
- [ ] SMTP delivers portal OTP + admin 2FA
- [ ] `NEXT_PUBLIC_SITE_URL` is canonical HTTPS origin
- [ ] Skip-pay / E2E flags absent from Production
- [ ] Smoke: one real ₹1 / test-key checkout → paid → invoice PDF → packing PDF
- [ ] Smoke: portal OTP + admin login + logout revoke
- [ ] Cron routes authenticated with `CRON_SECRET`
- [ ] Sentry receiving a test error

---

## What was deliberately not rewritten

- Marketing “Coming soon” catalogue / tools sections (product roadmap, not stubs for core paths)
- Full admin “command center” dashboard redesign (UX enhancement, not a security blocker)
- Private blob migration (requires Blob ACL + signed URL product change)
- Dark mode (explicitly out of brand policy)

---

## Method

1. Parallel repo scan (placeholders, secrets, gates)  
2. Money-path / auth deep audit  
3. Critical/High fixes implemented and typechecked  
4. Health unit tests updated  
5. This report  

**Prior enterprise review baseline:** ~41 overall → mid-80s after R1–R8 → **88** after this production hardening pass.
