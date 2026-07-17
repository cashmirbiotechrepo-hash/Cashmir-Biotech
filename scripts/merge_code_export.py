#!/usr/bin/env python3
"""
Merge admin-panel security, customer login, and payment gateway code into a
single reviewable text file.

Usage (from the repo root):
    python scripts/merge_code_export.py

Output: code-export.txt in the repo root, with three ordered sections:
    1. Admin panel security logic + API routes
    2. Customer (portal) login
    3. Payment gateway processing (Razorpay)
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FILE = REPO_ROOT / "code-export.txt"

# Files are listed in reading order within each section.
SECTIONS: list[tuple[str, list[str]]] = [
    (
        "1. ADMIN PANEL SECURITY LOGIC + API ROUTES",
        [
            # Request gatekeeping (runs before every request)
            "src/middleware.ts",
            "src/config/auth.constants.ts",
            # Core auth: cookies, sessions, current admin
            "src/lib/auth.ts",
            "src/lib/auth-edge.ts",
            # Token minting / rotation / reuse detection
            "src/lib/admin/tokens.ts",
            # Login flow: password, 2FA, proof-of-work, RBAC
            "src/lib/admin/auth-service.ts",
            "src/lib/admin/auth-context.ts",
            "src/lib/admin/password.ts",
            "src/lib/admin/two-factor.ts",
            "src/lib/admin/pow.ts",
            "src/lib/admin/pow-client.ts",
            "src/lib/admin/rbac.ts",
            # Cookie/token encryption
            "src/lib/admin/encryption.ts",
            "src/lib/admin/encryption-edge.ts",
            "src/lib/admin/secrets.ts",
            # Edge-side rate limiting and revocation checks
            "src/lib/rate-limit-edge.ts",
            "src/lib/session-revoke-edge.ts",
            # Login UI + server action
            "src/app/(admin)/admin/login/page.tsx",
            "src/app/(admin)/admin/login/actions.ts",
            "src/app/(admin)/admin/login/login-form.tsx",
            "src/components/admin/session-keepalive.tsx",
            # Admin auth API routes
            "src/app/api/admin/auth/pow-challenge/route.ts",
            "src/app/api/admin/auth/refresh/route.ts",
            "src/app/api/admin/auth/logout/route.ts",
            "src/app/api/admin/auth/me/route.ts",
        ],
    ),
    (
        "2. CUSTOMER (PORTAL) LOGIN",
        [
            # Core customer auth: OTP sessions, cookies, token rotation
            "src/lib/customer/auth.ts",
            "src/lib/customer/portal.ts",
            # Customer auth API routes (OTP-based login)
            "src/app/api/portal/auth/otp/request/route.ts",
            "src/app/api/portal/auth/otp/verify/route.ts",
            "src/app/api/portal/auth/refresh/route.ts",
            "src/app/api/portal/auth/logout/route.ts",
            "src/components/portal/customer-session-keepalive.tsx",
            # OTP email delivery
            "src/lib/email/otp-email.ts",
        ],
    ),
    (
        "3. PAYMENT GATEWAY PROCESSING (RAZORPAY)",
        [
            # Gateway client + signature verification
            "src/lib/payments/razorpay.ts",
            # Order creation -> payment -> verification flow
            "src/app/api/checkout/route.ts",
            "src/app/api/payment/verify/route.ts",
            "src/app/api/webhooks/razorpay/route.ts",
            "src/app/api/cron/reconcile-payments/route.ts",
            # Order + refund services that record payment state
            "src/modules/shop/services/order.service.ts",
            "src/modules/shop/services/refund.service.ts",
        ],
    ),
]

SECTION_BAR = "=" * 100
FILE_BAR = "-" * 100


def main() -> None:
    total_files = 0
    missing: list[str] = []

    with OUTPUT_FILE.open("w", encoding="utf-8") as out:
        out.write("CASHMIR BIOTECH — SECURITY & PAYMENTS CODE EXPORT\n")
        out.write(f"Generated: {datetime.now().isoformat(timespec='seconds')}\n")
        out.write(f"Repo root: {REPO_ROOT}\n\n")

        # Table of contents
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
    if missing:
        print("Missing files (skipped):")
        for rel in missing:
            print(f"  - {rel}")


if __name__ == "__main__":
    main()
