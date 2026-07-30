#!/usr/bin/env python3
"""
Merge every file involved in payments / Razorpay gateway handling into one
audit-ready text dump.

Covers: gateway client, checkout + verify + webhook routes, pricing/money,
refunds, reconcile cron, stock reservation at checkout, admin refund UI,
storefront checkout UI, and related Prisma models/migrations.

Usage (from the repo root):
    python scripts/merge_payment_gateway_export.py

Output (gitignored via /*.txt):
    payment-gateway-export.txt
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FILE = REPO_ROOT / "payment-gateway-export.txt"

# Ordered for auditors: config → gateway → money/pricing → APIs → services → UI → DB.
SECTIONS: list[tuple[str, list[str]]] = [
    (
        "0. HOW TO READ THIS (PAYMENT FLOW)",
        [],  # notes written in main()
    ),
    (
        "1. ENV + MIDDLEWARE + CRON AUTH (gateway secrets, CSP, rate limits)",
        [
            "src/config/env.server.ts",
            "src/middleware.ts",
            "src/lib/cron-auth.ts",
            "src/lib/api-utils.ts",
            "src/lib/rate-limit-edge.ts",
        ],
    ),
    (
        "2. RAZORPAY GATEWAY CLIENT + MONEY",
        [
            "src/lib/payments/razorpay.ts",
            "src/lib/money.ts",
            "src/lib/money.test.ts",
        ],
    ),
    (
        "3. PRICING / CHECKOUT / ORDER STATE / REFUNDS / OUTBOX",
        [
            "src/modules/shop/services/pricing.service.ts",
            "src/modules/shop/services/checkout.service.ts",
            "src/modules/shop/services/order-state.service.ts",
            "src/modules/shop/services/order.service.ts",
            "src/modules/shop/services/refund.service.ts",
            "src/modules/shop/services/outbox.service.ts",
            # Stock reservation happens inside checkout before payment
            "src/modules/admin/services/inventory.service.ts",
            "src/modules/shop/services/order.service.test.ts",
        ],
    ),
    (
        "4. API ROUTES (cart price → checkout → verify → webhook → crons)",
        [
            "src/app/api/cart/price/route.ts",
            "src/app/api/checkout/route.ts",
            "src/app/api/payment/verify/route.ts",
            "src/app/api/webhooks/razorpay/route.ts",
            "src/app/api/cron/reconcile-payments/route.ts",
            "src/app/api/cron/release-stale-orders/route.ts",
            "src/app/api/cron/process-outbox/route.ts",
        ],
    ),
    (
        "5. ADMIN REFUND ACTIONS + UI",
        [
            "src/app/(admin)/admin/(console)/order-ops-actions.ts",
            "src/components/admin/order-ops-actions.tsx",
        ],
    ),
    (
        "6. STOREFRONT CHECKOUT UI",
        [
            "src/app/(public)/checkout/page.tsx",
            "src/components/shop/checkout-view.tsx",
            "src/components/shop/checkout-chrome.tsx",
            "src/components/shop/cart-context.tsx",
        ],
    ),
    (
        "7. TRANSACTIONAL EMAIL (order paid / confirmation)",
        [
            "src/lib/email/transactional.ts",
        ],
    ),
    (
        "8. DATABASE (schema + payment-related migrations)",
        [
            "prisma/schema.prisma",
            "prisma/migrations/20260714160000_money_checks_razorpay_unique/migration.sql",
            "prisma/migrations/20260717160000_order_refund_idempotency/migration.sql",
            "prisma/migrations/20260717200000_invoice_seq_and_outbox_retry/migration.sql",
            "prisma/migrations/20260717210000_payment_event_processed_at/migration.sql",
        ],
    ),
]

SECTION_BAR = "=" * 100
FILE_BAR = "-" * 100

AUDIT_NOTES = """
PAYMENT / GATEWAY FLOW (high level)
  1. Storefront cart → POST /api/cart/price (server-side reprice)
  2. Checkout UI → POST /api/checkout
       - prices cart, creates Order (pending), reserves stock
       - creates Razorpay order via src/lib/payments/razorpay.ts
  3. Browser opens Razorpay Checkout (checkout.razorpay.com)
  4. Success → POST /api/payment/verify (signature check + mark paid)
  5. Razorpay also POSTs → /api/webhooks/razorpay (authoritative, idempotent)
  6. Cron reconcile-payments catches missed webhooks / stuck pending
  7. Admin refunds via order-ops-actions → Razorpay refund API + OrderRefund row

LIKELY AUDIT HOTSPOTS
  - src/lib/payments/razorpay.ts          — HMAC verify, refunds, API calls
  - src/app/api/checkout/route.ts         — amount authority (never trust client)
  - src/app/api/payment/verify/route.ts   — client-side verify path
  - src/app/api/webhooks/razorpay/route.ts — webhook signature + PaymentEvent
  - src/modules/shop/services/refund.service.ts — refund idempotency
  - src/middleware.ts                     — webhook exemption + checkout rate limits
  - src/config/env.server.ts              — RAZORPAY_* secrets required in prod

NOT INCLUDED
  - Generic admin order UI that only displays payment fields
  - Invoice PDF rendering (post-payment document, not gateway logic)
  - Unrelated marketing / CRM modules
""".strip()


def main() -> None:
    total_files = 0
    missing: list[str] = []
    all_paths: list[str] = []

    for title, files in SECTIONS:
        if title.startswith("0."):
            continue
        all_paths.extend(files)

    with OUTPUT_FILE.open("w", encoding="utf-8") as out:
        out.write("CASHMIR BIOTECH — PAYMENT / RAZORPAY GATEWAY CODE EXPORT\n")
        out.write("Checkout, verify, webhooks, refunds, reconcile, money/pricing\n")
        out.write(f"Generated: {datetime.now().isoformat(timespec='seconds')}\n")
        out.write(f"Repo root: {REPO_ROOT}\n")
        out.write(f"File count (expected): {len(all_paths)}\n\n")

        out.write(f"{SECTION_BAR}\n")
        out.write("    0. HOW TO READ THIS (PAYMENT FLOW)\n")
        out.write(f"{SECTION_BAR}\n\n")
        out.write(AUDIT_NOTES)
        out.write("\n\n")

        out.write("TABLE OF CONTENTS\n")
        for title, files in SECTIONS:
            if title.startswith("0."):
                continue
            out.write(f"\n{title}\n")
            for rel in files:
                out.write(f"    {rel}\n")
        out.write("\n\n")

        for title, files in SECTIONS:
            if title.startswith("0."):
                continue

            out.write(f"{SECTION_BAR}\n")
            out.write(f"{SECTION_BAR}\n")
            out.write(f"    {title}\n")
            out.write(f"{SECTION_BAR}\n")
            out.write(f"{SECTION_BAR}\n\n")

            for rel in files:
                path = REPO_ROOT / rel
                out.write(f"{FILE_BAR}\n")
                out.write(f"FILE: {rel}\n")
                out.write(f"{FILE_BAR}\n")

                if not path.is_file():
                    missing.append(rel)
                    out.write("!! FILE NOT FOUND — skipped\n\n")
                    continue

                content = path.read_text(encoding="utf-8")
                out.write(content)
                if not content.endswith("\n"):
                    out.write("\n")
                out.write("\n")
                total_files += 1

    print(f"Wrote {total_files} files into {OUTPUT_FILE}")
    print(f"Size: {OUTPUT_FILE.stat().st_size:,} bytes")
    if missing:
        print("Missing files (skipped):")
        for rel in missing:
            print(f"  - {rel}")
    else:
        print("All listed files were found.")
    print("\nManifest:")
    for rel in all_paths:
        print(f"  {rel}")


if __name__ == "__main__":
    main()
