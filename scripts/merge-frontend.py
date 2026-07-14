#!/usr/bin/env python3
"""Merge all frontend source files into a single annotated text file.

Walks the project's frontend code (everything under ``src/`` plus the key
styling / config files) and concatenates it into one ``.txt`` file. Each file
is preceded by a header showing its location (path relative to the project
root), so the output doubles as a readable, shareable snapshot of the UI code.

Usage:
    python scripts/merge-frontend.py                # -> frontend-code.txt
    python scripts/merge-frontend.py -o out.txt     # custom output path
    python scripts/merge-frontend.py --include-backend   # include lib/api/modules too
"""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

# Project root = parent of the folder this script lives in.
ROOT = Path(__file__).resolve().parent.parent

# File extensions considered "frontend code".
CODE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".css"}

# Directories to always skip (build output, deps, tooling caches, etc.).
SKIP_DIRS = {
    "node_modules",
    ".next",
    ".git",
    ".cursor",
    ".agents",
    "dist",
    "build",
    "coverage",
    "__pycache__",
}

# Root-level config files that shape the frontend.
ROOT_CONFIG_FILES = [
    "tailwind.config.ts",
    "postcss.config.js",
    "postcss.config.mjs",
    "postcss.config.cjs",
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "components.json",
    "tsconfig.json",
    "package.json",
]

# Paths (relative to ROOT) treated as backend-only; skipped unless
# --include-backend is passed.
BACKEND_PREFIXES = [
    "src/lib",
    "src/modules",
    "src/config",
    "src/middleware.ts",
    "src/instrumentation.ts",
    "src/app/api",
]

# Frontend helpers we always keep even when excluding the backend.
BACKEND_ALLOWLIST = {
    "src/lib/utils.ts",
    "src/lib/motion",
}


def rel(path: Path) -> str:
    """Project-relative path using forward slashes."""
    return path.relative_to(ROOT).as_posix()


def is_backend(rel_path: str, include_backend: bool) -> bool:
    if include_backend:
        return False
    if any(rel_path == a or rel_path.startswith(a + "/") for a in BACKEND_ALLOWLIST):
        return False
    return any(
        rel_path == p or rel_path.startswith(p + "/") for p in BACKEND_PREFIXES
    )


def collect_files(include_backend: bool) -> list[Path]:
    files: list[Path] = []

    src_dir = ROOT / "src"
    if src_dir.is_dir():
        for path in src_dir.rglob("*"):
            if not path.is_file():
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.suffix.lower() not in CODE_EXTENSIONS:
                continue
            if is_backend(rel(path), include_backend):
                continue
            files.append(path)

    for name in ROOT_CONFIG_FILES:
        candidate = ROOT / name
        if candidate.is_file():
            files.append(candidate)

    # De-duplicate and sort for a stable, readable ordering.
    unique = sorted(set(files), key=lambda p: rel(p))
    return unique


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="replace")


def build_output(files: list[Path]) -> str:
    lines: list[str] = []
    bar = "=" * 78

    lines.append(bar)
    lines.append("CASHMIR BIOTECH — FRONTEND CODE SNAPSHOT")
    lines.append(f"Generated: {datetime.now().isoformat(timespec='seconds')}")
    lines.append(f"Root: {ROOT}")
    lines.append(f"Files: {len(files)}")
    lines.append(bar)
    lines.append("")

    # Table of contents.
    lines.append("TABLE OF CONTENTS")
    lines.append("-" * 78)
    for i, path in enumerate(files, 1):
        lines.append(f"{i:>3}. {rel(path)}")
    lines.append("")
    lines.append(bar)
    lines.append("")

    # File bodies.
    for i, path in enumerate(files, 1):
        location = rel(path)
        content = read_text(path).rstrip("\n")
        line_count = content.count("\n") + 1 if content else 0

        lines.append(bar)
        lines.append(f"FILE {i}/{len(files)}: {location}")
        lines.append(f"LINES: {line_count}")
        lines.append(bar)
        lines.append(content)
        lines.append("")
        lines.append("")

    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "-o",
        "--output",
        default="frontend-code.txt",
        help="Output text file (default: frontend-code.txt in the project root).",
    )
    parser.add_argument(
        "--include-backend",
        action="store_true",
        help="Also include lib/modules/config/api server code.",
    )
    args = parser.parse_args()

    files = collect_files(args.include_backend)
    if not files:
        print("No frontend files found. Is this the project root?")
        return

    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = ROOT / output_path

    output_path.write_text(build_output(files), encoding="utf-8")

    total_bytes = output_path.stat().st_size
    print(f"Merged {len(files)} files -> {output_path}")
    print(f"Size: {total_bytes / 1024:.1f} KB")


if __name__ == "__main__":
    main()
