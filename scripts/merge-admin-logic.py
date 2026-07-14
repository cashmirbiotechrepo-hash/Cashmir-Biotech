#!/usr/bin/env python3
"""Merge admin panel + shared logic + API routes into one annotated .txt file.

Collects Cashmir Biotech source that powers:
  - Admin panel UI / routes / server actions
  - Admin libs, modules, and API endpoints
  - Shared logic that connects admin ↔ public (CMS, shop, auth, payments)
  - Middleware + Prisma schema

Each file is wrapped with its project-relative path so the dump is searchable.

Excludes: node_modules, .next, SKIIE-TEMP-main, Admin Panel Template, etc.

Usage:
    python scripts/merge-admin-logic.py
    python scripts/merge-admin-logic.py -o admin-logic-bundle.txt
    python scripts/merge-admin-logic.py --list   # print paths only, no merge
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CODE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".prisma", ".sql"}

SKIP_DIR_NAMES = {
    "node_modules",
    ".next",
    ".git",
    ".cursor",
    ".agents",
    "dist",
    "build",
    "coverage",
    "__pycache__",
    "SKIIE-TEMP-main",
    "Admin Panel Template",
    "public",
    "uploads",
}

# Roots / files that define admin ↔ main connectivity and business logic.
INCLUDE_SPEC: list[str] = [
    # Admin app (routes, layouts, server actions)
    "src/app/(admin)",
    # Admin UI components
    "src/components/admin",
    # HTTP APIs (admin + public shop + webhooks + tools)
    "src/app/api",
    # Domain modules
    "src/modules",
    # Admin + auth + payments + edge helpers
    "src/lib/admin",
    "src/lib/auth.ts",
    "src/lib/auth-edge.ts",
    "src/lib/db.ts",
    "src/lib/logger.ts",
    "src/lib/payments",
    "src/lib/rate-limit-edge.ts",
    "src/lib/site-contact.ts",
    # Edge middleware (admin auth gates + rate limits)
    "src/middleware.ts",
    "src/instrumentation.ts",
    # Data model (admin + main share this)
    "prisma/schema.prisma",
    "prisma/seed.ts",
]

# Optional public shop routes that talk to the same order/product model.
# Kept so the dump shows how admin inventory/orders connect to the storefront.
BRIDGE_PUBLIC_ROUTES: list[str] = [
    "src/app/(public)/products",
    "src/app/(public)/cart",
    "src/app/(public)/checkout",
    "src/app/(public)/order",
    "src/components/shop",
]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def should_skip_dir(name: str) -> bool:
    return name in SKIP_DIR_NAMES or name.startswith(".")


def expand_spec(spec: str) -> list[Path]:
    """Resolve a relative file or directory into concrete files."""
    target = ROOT / spec
    out: list[Path] = []

    if target.is_file():
        if target.suffix.lower() in CODE_EXTENSIONS:
            out.append(target)
        return out

    if not target.is_dir():
        return out

    for path in sorted(target.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in CODE_EXTENSIONS:
            continue
        # Honour skip folders anywhere in the path under target
        if any(should_skip_dir(part) for part in path.relative_to(ROOT).parts):
            continue
        out.append(path)

    return out


def collect_files(include_bridge: bool) -> list[Path]:
    specs = list(INCLUDE_SPEC)
    if include_bridge:
        specs.extend(BRIDGE_PUBLIC_ROUTES)

    seen: set[Path] = set()
    files: list[Path] = []
    for spec in specs:
        for path in expand_spec(spec):
            resolved = path.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)
            files.append(path)

    files.sort(key=lambda p: rel(p).lower())
    return files


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="replace")


def write_bundle(files: list[Path], output: Path) -> None:
    lines: list[str] = []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    lines.append("=" * 88)
    lines.append("Cashmir Biotech - Admin panel + logic + API + bridge routes")
    lines.append(f"Generated: {now}")
    lines.append(f"Root: {ROOT}")
    lines.append(f"Files: {len(files)}")
    lines.append("=" * 88)
    lines.append("")
    lines.append("TABLE OF CONTENTS")
    lines.append("-" * 40)
    for i, path in enumerate(files, 1):
        lines.append(f"{i:4d}. {rel(path)}")
    lines.append("")
    lines.append("")

    for path in files:
        location = rel(path)
        lines.append("=" * 88)
        lines.append(f"FILE: {location}")
        lines.append(f"ABS:  {path}")
        lines.append("=" * 88)
        lines.append("")
        content = read_text(path).rstrip("\n")
        lines.append(content)
        lines.append("")
        lines.append("")

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Merge admin + logic + API files into one .txt with paths."
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=ROOT / "admin-logic-api-bundle.txt",
        help="Output .txt path (default: admin-logic-api-bundle.txt)",
    )
    parser.add_argument(
        "--no-bridge",
        action="store_true",
        help="Skip public shop bridge routes/components (products/cart/checkout/shop)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="Only list included file paths; do not write the bundle",
    )
    args = parser.parse_args()

    files = collect_files(include_bridge=not args.no_bridge)
    if not files:
        print("No files matched. Check INCLUDE_SPEC paths.")
        return 1

    if args.list:
        for path in files:
            print(rel(path))
        print(f"\n{len(files)} files")
        return 0

    out = args.output if args.output.is_absolute() else ROOT / args.output
    write_bundle(files, out)
    size_kb = out.stat().st_size / 1024
    print(f"Wrote {len(files)} files -> {out}")
    print(f"Size: {size_kb:,.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
