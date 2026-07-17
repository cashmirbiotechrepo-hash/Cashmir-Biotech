#!/usr/bin/env python3
"""
Merge Cashmir Biotech source into a single reviewable text file.

Sections (in order):
  1. Database + Prisma
  2. Customer Portal
  3. Whole website API Routes
  4. Orders + Inventory
  5. Project Architecture
  6. Configuration & Infrastructure

Usage (from the repo root):
    python scripts/merge_project_export.py

Output:
    project-export.txt
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FILE = REPO_ROOT / "project-export.txt"

SECTION_BAR = "=" * 100
FILE_BAR = "-" * 100

SKIP_NAME_PARTS = {
    "new_audit.md",
    "node_modules",
    "coverage",
}


def to_posix(path: Path) -> str:
    return path.relative_to(REPO_ROOT).as_posix()


def exists_sorted(paths: list[str]) -> list[str]:
    found: list[str] = []
    for rel in paths:
        if (REPO_ROOT / rel).is_file():
            found.append(rel)
    return found


def discover_glob(pattern: str, *, exclude_tests: bool = True) -> list[str]:
    matches: list[str] = []
    for path in sorted(REPO_ROOT.glob(pattern)):
        if not path.is_file():
            continue
        rel = to_posix(path)
        if any(part in rel for part in SKIP_NAME_PARTS):
            continue
        if exclude_tests and (rel.endswith(".test.ts") or rel.endswith(".test.tsx")):
            continue
        matches.append(rel)
    return matches


def discover_under(directory: str, suffixes: tuple[str, ...] = (".ts", ".tsx")) -> list[str]:
    root = REPO_ROOT / directory
    if not root.is_dir():
        return []
    matches: list[str] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix not in suffixes:
            continue
        rel = to_posix(path)
        if any(part in rel for part in SKIP_NAME_PARTS):
            continue
        if rel.endswith(".test.ts") or rel.endswith(".test.tsx"):
            continue
        matches.append(rel)
    return matches


def build_sections() -> list[tuple[str, list[str]]]:
    # 1) Database + Prisma
    db_prisma = [
        "prisma/schema.prisma",
        "prisma/migrations/migration_lock.toml",
        *discover_glob("prisma/migrations/*/migration.sql", exclude_tests=False),
        "src/lib/db.ts",
        "src/lib/db-pool.ts",
        "src/lib/database-url.ts",
    ]

    # 2) Customer Portal (auth + UI + portal server actions; API routes live in section 3)
    customer_portal = [
        "src/lib/customer/auth.ts",
        "src/lib/customer/portal.ts",
        "src/lib/customer/portal-ui.ts",
        "src/lib/email/otp-email.ts",
        *discover_under("src/components/portal"),
        *discover_under("src/app/(portal)"),
        "src/modules/shop/services/org-invite.service.ts",
        "src/modules/shop/services/research-circle.service.ts",
    ]
    customer_portal = exists_sorted(customer_portal)

    # 3) Whole website API routes
    api_routes = discover_glob("src/app/api/**/route.ts")

    # 4) Orders + Inventory
    orders_inventory = exists_sorted(
        [
            "src/modules/shop/services/order.service.ts",
            "src/modules/shop/services/order-ops.service.ts",
            "src/modules/shop/services/refund.service.ts",
            "src/modules/shop/services/outbox.service.ts",
            "src/modules/shop/services/invoice-pdf.service.ts",
            "src/modules/shop/services/invoice-persist.service.ts",
            "src/modules/shop/services/packing-pdf.service.ts",
            "src/modules/shop/services/pdf-brand.ts",
            "src/modules/admin/services/inventory.service.ts",
            "src/modules/admin/services/inventory-lots.service.ts",
            "src/lib/payments/razorpay.ts",
            "src/lib/gst.ts",
            "src/lib/admin/order-workflow.ts",
        ]
    )

    # 5) Project Architecture (request pipeline, app shells, domain modules overview)
    architecture = exists_sorted(
        [
            "README.md",
            "src/middleware.ts",
            "src/instrumentation.ts",
            "src/app/layout.tsx",
            "src/app/(public)/layout.tsx",
            "src/app/(admin)/admin/(console)/layout.tsx",
            "src/app/(portal)/portal/(session)/layout.tsx",
            "src/lib/auth.ts",
            "src/lib/auth-edge.ts",
            "src/lib/api-utils.ts",
            "src/lib/logger.ts",
            "src/lib/cron-auth.ts",
            "src/lib/session-revoke-edge.ts",
            "src/modules/admin/services/audit.service.ts",
            "src/modules/admin/services/dashboard.service.ts",
            "src/modules/admin/services/phase2.service.ts",
        ]
    )

    # 6) Configuration & Infrastructure
    configuration = exists_sorted(
        [
            "package.json",
            ".nvmrc",
            "tsconfig.json",
            "next.config.ts",
            "eslint.config.mjs",
            "amplify.yml",
            "src/config/env.server.ts",
            "src/config/auth.constants.ts",
            "src/lib/feature-flags.ts",
            "src/lib/rate-limit-edge.ts",
            "src/lib/apply-baked-env.ts",
            "src/lib/apply-baked-env-shared.ts",
            "src/generated/amplify-runtime-env.json",
            "scripts/write-amplify-runtime-env.cjs",
            "scripts/ensure-shipping-settings.cjs",
            "scripts/merge_code_export.py",
            "scripts/merge_project_export.py",
        ]
    )

    return [
        ("1. DATABASE + PRISMA", db_prisma),
        ("2. CUSTOMER PORTAL", customer_portal),
        ("3. WHOLE WEBSITE API ROUTES", api_routes),
        ("4. ORDERS + INVENTORY", orders_inventory),
        ("5. PROJECT ARCHITECTURE", architecture),
        ("6. CONFIGURATION & INFRASTRUCTURE", configuration),
    ]


def main() -> None:
    sections = build_sections()
    total_files = 0
    missing: list[str] = []

    with OUTPUT_FILE.open("w", encoding="utf-8") as out:
        out.write("CASHMIR BIOTECH — PROJECT CODE EXPORT\n")
        out.write(f"Generated: {datetime.now().isoformat(timespec='seconds')}\n")
        out.write(f"Repo root: {REPO_ROOT}\n\n")

        # Build first-occurrence map so TOC can mark later duplicates.
        first_section: dict[str, str] = {}
        for title, files in sections:
            for rel in files:
                first_section.setdefault(rel, title)

        out.write("TABLE OF CONTENTS\n")
        for title, files in sections:
            out.write(f"\n{title}\n")
            for rel in files:
                if first_section.get(rel) == title:
                    out.write(f"    {rel}\n")
                else:
                    out.write(f"    {rel}  [also listed under {first_section[rel]}; content once only]\n")
        out.write("\n\n")

        written: set[str] = set()
        for title, files in sections:
            out.write(f"{SECTION_BAR}\n")
            out.write(f"{SECTION_BAR}\n")
            out.write(f"    {title}\n")
            out.write(f"{SECTION_BAR}\n")
            out.write(f"{SECTION_BAR}\n\n")

            for rel in files:
                out.write(f"{FILE_BAR}\n")
                out.write(f"FILE: {rel}\n")
                out.write(f"{FILE_BAR}\n")

                if rel in written:
                    out.write("!! Already included earlier in this export — content omitted to avoid duplication.\n\n")
                    continue

                path = REPO_ROOT / rel
                if not path.is_file():
                    missing.append(rel)
                    out.write("!! FILE NOT FOUND — skipped\n\n")
                    continue

                content = path.read_text(encoding="utf-8")
                out.write(content)
                if not content.endswith("\n"):
                    out.write("\n")
                out.write("\n")
                written.add(rel)
                total_files += 1

    print(f"Wrote {total_files} unique files into {OUTPUT_FILE}")
    print(f"Size: {OUTPUT_FILE.stat().st_size:,} bytes")
    if missing:
        print("Missing files (skipped):")
        for rel in missing:
            print(f"  - {rel}")


if __name__ == "__main__":
    main()
