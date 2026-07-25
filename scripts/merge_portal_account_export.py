#!/usr/bin/env python3
"""
Merge every file involved in portal account work (Phases A–D + follow-ups)
into one audit-ready text dump, with each file's repo-relative path.

Covers:
  A — Nav & access (storefront avatar, portal Store, Overview, Account hub)
  B — Profile/address persistence, checkout consent, paid sync, fingerprint
  C — Buy again, tracking, cancel/return support, wishlist
  D — Guest claim, Org/Circle hide, CoA, notification prefs
  Follow-ups — Sonner toasts, marketing recipient wiring, IDOR/sync/QA tests

Usage (from the repo root):
    python scripts/merge_portal_account_export.py

Output (gitignored via /*.txt):
    portal-account-export.txt
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FILE = REPO_ROOT / "portal-account-export.txt"

SECTION_BAR = "=" * 78
FILE_BAR = "-" * 78

AUDIT_NOTES = """\
HOW TO READ THIS EXPORT
-----------------------
This dump is the Cashmir Biotech **portal / customer account** implementation
from Phase A through Phase D, plus post-build follow-ups (toasts, marketing
sender wiring, automated IDOR/sync/QA tests).

Phases (see docs/portal-account-plan.md):
  A  Navigation & access
  B  Address/profile persistence + payment-confirmed sync
  C  Order habits (buy again, tracking, wishlist, support intents)
  D  Biotech extras (CoA, claim banner, prefs, hide empty Org/Circle)

Each FILE: line is the path relative to the repo root.
"""

# Ordered for auditors: plan → schema → libs → actions → UI → checkout → sync → tests.
SECTIONS: list[tuple[str, list[str]]] = [
    (
        "0. PLAN",
        [
            "docs/portal-account-plan.md",
        ],
    ),
    (
        "1. SCHEMA + MIGRATIONS + CUTOVER HELPERS",
        [
            "prisma/schema.prisma",
            "prisma/migrations/20260725120000_account_address_fingerprint/migration.sql",
            "prisma/migrations/20260725121000_account_address_fingerprint_merge_unique/migration.sql",
            "prisma/migrations/20260725130000_customer_wishlist/migration.sql",
            "prisma/migrations/20260725140000_phase_d_claim_notify/migration.sql",
            "scripts/count-address-fingerprint-dupes.ts",
        ],
    ),
    (
        "2. PHASE A — NAV & ACCESS",
        [
            "src/components/experience/site-nav.tsx",
            "src/components/portal/portal-shell.tsx",
            "src/app/(portal)/portal/(session)/page.tsx",
            "src/app/(portal)/portal/(session)/account/page.tsx",
            "src/app/(portal)/portal/(session)/security/page.tsx",
            "src/app/(portal)/portal/(session)/organization/page.tsx",
            "src/lib/customer/portal-extras.ts",
            "src/lib/customer/portal.ts",
        ],
    ),
    (
        "3. PHASE B — ADDRESS / PROFILE LIBS + ACTIONS + UI",
        [
            "src/lib/customer/phone-in.ts",
            "src/lib/customer/address-match.ts",
            "src/lib/customer/addresses.ts",
            "src/lib/customer/checkout-address-mutation.ts",
            "src/app/(portal)/portal/(session)/actions.ts",
            "src/app/(portal)/portal/(session)/addresses/page.tsx",
            "src/app/(portal)/portal/(session)/layout.tsx",
            "src/components/portal/portal-address-form.tsx",
            "src/components/portal/portal-addresses-client.tsx",
            "src/components/portal/portal-profile-form.tsx",
            "src/components/portal/use-portal-action-toast.ts",
        ],
    ),
    (
        "4. PHASE B — CHECKOUT CONSENT + PAID SYNC + PAYMENT ENTRY",
        [
            "src/components/shop/checkout-view.tsx",
            "src/app/(public)/checkout/page.tsx",
            "src/app/api/checkout/route.ts",
            "src/modules/shop/services/order.service.ts",
            "src/modules/shop/services/checkout.service.ts",
            "src/modules/shop/services/order-state.service.ts",
            "src/modules/shop/services/order-ops.service.ts",
            "src/modules/shop/services/outbox.service.ts",
            "src/app/api/payment/verify/route.ts",
            "src/app/api/webhooks/razorpay/route.ts",
            "src/lib/customer/auth.ts",
            "src/modules/admin/services/inventory.service.ts",
        ],
    ),
    (
        "5. PHASE C — ORDER HABITS (BUY AGAIN, TRACKING, WISHLIST, SUPPORT)",
        [
            "src/lib/shipping/tracking-url.ts",
            "src/lib/customer/wishlist.ts",
            "src/components/portal/buy-again-button.tsx",
            "src/components/shop/wishlist-toggle.tsx",
            "src/components/portal/wishlist-client.tsx",
            "src/app/(portal)/portal/(session)/wishlist/page.tsx",
            "src/app/(portal)/portal/(session)/orders/[orderNumber]/page.tsx",
            "src/app/(portal)/portal/(session)/support/page.tsx",
            "src/components/portal/portal-support-form.tsx",
            "src/app/(public)/products/[slug]/page.tsx",
            "src/lib/email/transactional.ts",
        ],
    ),
    (
        "6. PHASE D — CLAIM, PREFS, MARKETING, COA HOOKS",
        [
            "src/lib/customer/address-claim.ts",
            "src/components/portal/address-claim-banner.tsx",
            "src/components/portal/notification-prefs-form.tsx",
            "src/lib/customer/marketing-prefs.ts",
            "src/app/(admin)/admin/(console)/phase2-actions.ts",
        ],
    ),
    (
        "7. TESTS (IDOR / SYNC / §8.4 QA POLICY)",
        [
            "src/lib/customer/address-account.test.ts",
            "src/lib/customer/portal-idor-sync.test.ts",
            "src/lib/customer/portal-account-qa.test.ts",
        ],
    ),
]


def main() -> None:
    all_paths: list[str] = []
    seen: set[str] = set()
    for _title, files in SECTIONS:
        for rel in files:
            if rel not in seen:
                seen.add(rel)
                all_paths.append(rel)

    missing: list[str] = []
    total_files = 0

    with OUTPUT_FILE.open("w", encoding="utf-8", newline="\n") as out:
        out.write(f"{SECTION_BAR}\n")
        out.write("  CASHMIR BIOTECH — PORTAL ACCOUNT EXPORT (Phases A–D)\n")
        out.write(f"{SECTION_BAR}\n")
        out.write(f"Generated: {datetime.now().isoformat(timespec='seconds')}\n")
        out.write(f"Repo root: {REPO_ROOT}\n")
        out.write(f"File count (expected): {len(all_paths)}\n\n")

        out.write(f"{SECTION_BAR}\n")
        out.write("    HOW TO READ THIS\n")
        out.write(f"{SECTION_BAR}\n\n")
        out.write(AUDIT_NOTES)
        out.write("\n\n")

        out.write("TABLE OF CONTENTS\n")
        for title, files in SECTIONS:
            out.write(f"\n{title}\n")
            for rel in files:
                out.write(f"    {rel}\n")
        out.write("\n\n")

        for title, files in SECTIONS:
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
