#!/usr/bin/env python3
"""
Merge every file involved in admin session expiry / refresh and customer
(portal) login into one audit-ready text dump.

The admin login banner "Your session expired. Sign in again to continue."
comes from src/app/(admin)/admin/login/login-form.tsx when ?reason=session
(or similar) is set by middleware / auth redirects.

Usage (from the repo root):
    python scripts/merge_auth_session_export.py

Output (gitignored via /*.txt):
    auth-session-export.txt
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FILE = REPO_ROOT / "auth-session-export.txt"

# Ordered for auditors: gate → cookies/JWT → rotation → login UI → APIs → DB.
SECTIONS: list[tuple[str, list[str]]] = [
    (
        "0. HOW TO READ THIS (SESSION EXPIRED FLOW)",
        [
            # Tiny index-only placeholder — real notes written in main()
        ],
    ),
    (
        "1. EDGE GATE + COOKIE / JWT CONSTANTS + ENV",
        [
            "src/middleware.ts",
            "src/config/auth.constants.ts",
            "src/config/env.server.ts",
            "src/lib/auth-edge.ts",
            "src/lib/session-revoke-edge.ts",
            "src/lib/rate-limit-edge.ts",
            # Amplify SSR often starts with empty env — missing JWT_SECRET breaks sessions
            "src/lib/apply-baked-env.ts",
            "src/lib/apply-baked-env-shared.ts",
            "src/lib/database-url.ts",
            "scripts/write-amplify-runtime-env.cjs",
        ],
    ),
    (
        "2. ADMIN SESSION CORE (cookies, requireAdminSession, refresh rotation)",
        [
            "src/lib/auth.ts",
            "src/lib/admin/tokens.ts",
            "src/lib/admin/auth-service.ts",
            "src/lib/admin/auth-context.ts",
            "src/lib/admin/encryption.ts",
            "src/lib/admin/encryption-edge.ts",
            "src/lib/admin/secrets.ts",
            "src/lib/admin/password.ts",
            "src/lib/admin/password.test.ts",
            "src/lib/admin/two-factor.ts",
            "src/lib/admin/pow.ts",
            "src/lib/admin/pow-client.ts",
            "src/lib/admin/rbac.ts",
            "src/lib/cron-auth.ts",
        ],
    ),
    (
        "3. ADMIN LOGIN UI + KEEPALIVE + AUTH API ROUTES",
        [
            # Source of: "Your session expired. Sign in again to continue."
            "src/app/(admin)/admin/login/page.tsx",
            "src/app/(admin)/admin/login/actions.ts",
            "src/app/(admin)/admin/login/login-form.tsx",
            "src/components/admin/session-keepalive.tsx",
            "src/app/(admin)/admin/(console)/layout.tsx",
            "src/app/api/admin/auth/pow-challenge/route.ts",
            "src/app/api/admin/auth/refresh/route.ts",
            "src/app/api/admin/auth/logout/route.ts",
            "src/app/api/admin/auth/me/route.ts",
            "src/app/api/cron/cleanup-sessions/route.ts",
        ],
    ),
    (
        "4. CUSTOMER (PORTAL) LOGIN + SESSION / REFRESH",
        [
            "src/lib/customer/auth.ts",
            "src/lib/customer/portal.ts",
            "src/lib/email/otp-email.ts",
            "src/app/(portal)/portal/login/page.tsx",
            "src/components/portal/portal-login-form.tsx",
            "src/components/portal/customer-session-keepalive.tsx",
            "src/app/(portal)/portal/(session)/layout.tsx",
            "src/app/api/portal/auth/otp/request/route.ts",
            "src/app/api/portal/auth/otp/verify/route.ts",
            "src/app/api/portal/auth/refresh/route.ts",
            "src/app/api/portal/auth/logout/route.ts",
        ],
    ),
    (
        "5. DATABASE MODELS + MIGRATIONS (sessions / refresh tokens)",
        [
            "prisma/schema.prisma",
            "prisma/migrations/20260717170000_production_schema_repair/migration.sql",
            "prisma/migrations/20260717190000_customer_refresh_token/migration.sql",
        ],
    ),
]

SECTION_BAR = "=" * 100
FILE_BAR = "-" * 100

AUDIT_NOTES = """
SESSION-EXPIRED BANNER (admin)
  UI string lives in: src/app/(admin)/admin/login/login-form.tsx
  Triggered when the login page receives sessionExpired (typically via
  query param from middleware redirect when the access cookie is missing
  or JWT verification fails).

LIKELY AUDIT HOTSPOTS
  - src/middleware.ts              — redirects unauthenticated /admin → login
  - src/lib/auth-edge.ts           — Edge JWT verify (needs JWT_SECRET at edge)
  - src/lib/auth.ts                — cookies Path=/ for __Host- refresh
  - src/lib/admin/tokens.ts        — refresh rotation / reuse detection
  - src/app/api/admin/auth/refresh — keepalive + rotation endpoint
  - src/components/admin/session-keepalive.tsx — client refresh loop
  - Amplify baked env files        — empty JWT_SECRET on SSR ⇒ instant expiry
  - Customer parallels under src/lib/customer/auth.ts + portal refresh route

NOT INCLUDED (call requireAdminSession / requireCustomerSession only)
  Business action files (orders, products, etc.) — they consume sessions
  but do not implement login/refresh/cookie logic.
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
        out.write("CASHMIR BIOTECH — AUTH / SESSION CODE EXPORT\n")
        out.write("Admin session expiry + customer (portal) login\n")
        out.write(f"Generated: {datetime.now().isoformat(timespec='seconds')}\n")
        out.write(f"Repo root: {REPO_ROOT}\n")
        out.write(f"File count (expected): {len(all_paths)}\n\n")

        out.write(f"{SECTION_BAR}\n")
        out.write("    0. HOW TO READ THIS (SESSION EXPIRED FLOW)\n")
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
