import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";

export default async function AdminEntry() {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/admin/dashboard");
  redirect("/admin/login");
}
