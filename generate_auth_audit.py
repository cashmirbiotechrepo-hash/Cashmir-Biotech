import os

files_to_audit = [
    "src/middleware.ts",
    "src/app/(admin)/admin/login/login-form.tsx",
    "src/app/api/admin/auth/google/route.ts",
    "src/app/api/admin/auth/google/callback/route.ts",
    "src/app/api/admin/auth/logout/route.ts",
    "src/app/api/admin/auth/pow-challenge/route.ts",
    "src/app/api/admin/auth/refresh/route.ts",
    "src/app/api/portal/auth/google/route.ts",
    "src/app/api/portal/auth/google/callback/route.ts",
    "src/app/api/portal/auth/logout/route.ts",
    "src/app/api/portal/auth/otp/request/route.ts",
    "src/app/api/portal/auth/otp/verify/route.ts",
    "src/app/api/portal/auth/password/login/route.ts",
    "src/app/api/portal/auth/password/reset/confirm/route.ts",
    "src/app/api/portal/auth/password/reset/request/route.ts",
    "src/app/api/portal/auth/password/set/route.ts",
    "src/app/api/portal/auth/refresh/route.ts",
    "src/components/portal/portal-login-form.tsx",
    "src/config/auth.constants.ts",
    "src/lib/auth-edge.ts",
    "src/lib/auth.ts",
    "src/lib/oauth-state.ts",
    "src/lib/admin/auth-service.ts",
    "src/lib/admin/tokens.ts",
    "src/lib/customer/auth.ts",
    "src/lib/customer/oauth-session.ts",
]

output_file = "auth_audit_log.txt"

with open(output_file, "w", encoding="utf-8") as out:
    out.write("=================================================================\n")
    out.write("CASHMIR BIOTECH AUTHENTICATION LOGIC AUDIT DUMP\n")
    out.write("=================================================================\n\n")

    for filepath in files_to_audit:
        out.write(f"\n{'='*80}\n")
        out.write(f"FILE: {filepath}\n")
        out.write(f"{'='*80}\n\n")

        if os.path.exists(filepath):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                    out.write(content)
            except Exception as e:
                out.write(f"Error reading file: {e}\n")
        else:
            out.write(f"FILE NOT FOUND: {filepath}\n")
        
        out.write("\n\n")

print(f"Audit log successfully generated at {output_file}")
