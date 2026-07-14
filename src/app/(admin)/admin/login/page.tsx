import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { adminFont } from "@/lib/admin/fonts";
import { cn } from "@/lib/utils";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Admin Login · Cashmir Biotech",
  robots: { index: false, follow: false }
};

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; rateLimited?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/admin/dashboard");

  const params = await searchParams;
  const next = params.next?.startsWith("/admin") ? params.next : "/admin/dashboard";

  return (
    <main
      className={cn(
        adminFont.variable,
        "admin-scope font-admin flex min-h-svh flex-col items-center justify-center px-6 py-12"
      )}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="Cashmir Biotech" width={160} height={52} className="h-11 w-auto" priority />
          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Operations Console
          </p>
        </div>

        <LoginForm next={next} rateLimited={params.rateLimited === "1"} />

        <Link
          href="/"
          className="mx-auto mt-6 block w-fit text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to site
        </Link>
      </div>
    </main>
  );
}
