import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSessionKeepalive } from "@/components/admin/session-keepalive";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentAdmin } from "@/lib/auth";
import { adminFont } from "@/lib/admin/fonts";
import { cn } from "@/lib/utils";

export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin?.email) redirect("/admin/login");

  return (
    <TooltipProvider>
      <div className={cn(adminFont.variable, "admin-scope font-admin")}>
        <AdminSessionKeepalive />
        <AdminShell adminEmail={String(admin.email)} adminRole={String(admin.role)}>{children}</AdminShell>
      </div>
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  );
}
