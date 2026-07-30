#!/usr/bin/env python3
"""
Merge every file in the product / admin image-upload pipeline into one
audit-ready text dump.

Triggered by the UI error:
  "Couldn't save the uploaded image. Please try again."
from src/app/api/admin/upload/route.ts

Usage (from the repo root):
    python scripts/merge_image_upload_export.py

Output (gitignored via /*.txt):
    image-upload-export.txt
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FILE = REPO_ROOT / "image-upload-export.txt"

SECTIONS: list[tuple[str, list[str]]] = [
    (
        "0. HOW TO READ THIS (UPLOAD FAILURE FLOW)",
        [],
    ),
    (
        "1. UPLOAD API + VALIDATION (source of the generic error message)",
        [
            "src/app/api/admin/upload/route.ts",
            "src/lib/admin/upload-validation.ts",
            "src/lib/admin/api.ts",
            "src/lib/logger.ts",
        ],
    ),
    (
        "2. FRONTEND UPLOADER + PRODUCT EDITOR",
        [
            "src/components/admin/image-upload.tsx",
            "src/components/admin/products-table.tsx",
            "src/components/admin/media-library.tsx",
            "src/app/(admin)/admin/(console)/products/page.tsx",
            "src/app/(admin)/admin/(console)/media/page.tsx",
        ],
    ),
    (
        "3. PRODUCT SAVE + MEDIA SERVER ACTIONS",
        [
            "src/app/(admin)/admin/(console)/actions.ts",
            "src/app/(admin)/admin/(console)/media-actions.ts",
            "src/lib/admin/media-refs.ts",
            "src/modules/cms/validations/admin.ts",
            "src/modules/admin/validations/phase2.ts",
            "src/components/admin/admin-form.tsx",
        ],
    ),
    (
        "4. GATEKEEPING (middleware, rate limits, auth)",
        [
            "src/middleware.ts",
            "src/lib/rate-limit-edge.ts",
            "src/lib/auth.ts",
            "src/lib/admin/rbac.ts",
        ],
    ),
    (
        "5. ENV + STORAGE CONFIG (BLOB_READ_WRITE_TOKEN is required in production)",
        [
            "src/config/env.server.ts",
            "src/lib/apply-baked-env.ts",
            "src/lib/apply-baked-env-shared.ts",
            "scripts/write-amplify-runtime-env.cjs",
            "next.config.ts",
            "package.json",
        ],
    ),
    (
        "6. DATABASE (Product.imageUrl / images + MediaAsset)",
        [
            "prisma/schema.prisma",
            "prisma/migrations/20260414074520_init/migration.sql",
            "prisma/migrations/20260713120000_admin_phase1/migration.sql",
            "prisma/migrations/20260717170000_production_schema_repair/migration.sql",
        ],
    ),
    (
        "7. RELATED ADMIN UPLOAD CONSUMERS (patents / blog / team / CoA)",
        [
            "src/components/admin/patents-module.tsx",
            "src/components/admin/blog-module.tsx",
            "src/components/admin/team-editor.tsx",
            "src/components/admin/coa-manager.tsx",
            "src/app/(admin)/admin/(console)/phase2-actions.ts",
        ],
    ),
]

SECTION_BAR = "=" * 100
FILE_BAR = "-" * 100

AUDIT_NOTES = """
UI ERROR
  "Couldn't save the uploaded image. Please try again."
  Returned from: src/app/api/admin/upload/route.ts  (catch → adminErr upload_failed)

UPLOAD PIPELINE
  1. Admin product editor (ImageUploadField / GalleryUploadField)
       → POST /api/admin/upload  (multipart FormData, field "file")
  2. Middleware + Upstash rate limit on /api/admin/upload
  3. requireAdminApi() auth check
  4. Magic-byte validation (upload-validation.ts)
  5. Storage:
       - If BLOB_READ_WRITE_TOKEN set → @vercel/blob put("uploads/…")
       - Else if NODE_ENV=production → THROW (missing blob token)
       - Else local write to public/uploads/
  6. db.mediaAsset.create({ url, … })
  7. Client receives { url } and writes it into the product form (imageUrl / images)
  8. saveProductAction persists Product.imageUrl / Product.images

LIKELY ROOT CAUSES ON AMPLIFY (given no stack in logs)
  - BLOB_READ_WRITE_TOKEN missing/unset → intentional throw in production
  - Vercel Blob put() rejection (token invalid / network)
  - MediaAsset DB insert failure after successful put
  - Exception swallowed into generic message (logger.error exists but may not surface in Amplify UI)
  - Client never reaches API (auth redirect / CSRF / rate limit) — less likely if user sees this exact text

DEBUG HINT FROM AUDITOR
  Temporarily surface String(err) in the catch of upload/route.ts, or confirm
  Amplify env has BLOB_READ_WRITE_TOKEN and that @vercel/blob is reachable.

NOT INCLUDED
  - Public storefront display components that only render imageUrl
  - Email HTML that embeds product thumbnails
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
        out.write("CASHMIR BIOTECH — PRODUCT / ADMIN IMAGE UPLOAD CODE EXPORT\n")
        out.write('Error string: "Couldn\'t save the uploaded image. Please try again."\n')
        out.write(f"Generated: {datetime.now().isoformat(timespec='seconds')}\n")
        out.write(f"Repo root: {REPO_ROOT}\n")
        out.write(f"File count (expected): {len(all_paths)}\n\n")

        out.write(f"{SECTION_BAR}\n")
        out.write("    0. HOW TO READ THIS (UPLOAD FAILURE FLOW)\n")
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
