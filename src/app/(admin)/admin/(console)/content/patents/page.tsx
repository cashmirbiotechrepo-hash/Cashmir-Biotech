import { redirect } from "next/navigation";

export default function LegacyPatentsRedirect() {
  redirect("/admin/patents");
}
