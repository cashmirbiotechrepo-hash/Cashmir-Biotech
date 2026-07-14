import { AdminPageHeader } from "@/components/admin/page-header";
import { HomepageEditor } from "@/components/admin/content-forms";
import { getDashboardContent } from "@/modules/cms/services/content.service";

export const metadata = { title: "Homepage" };

export default async function AdminHomepagePage() {
  const content = await getDashboardContent();
  return (
    <>
      <AdminPageHeader
        title="Homepage"
        description="Edit hero copy, calls to action, and mission statement shown on the public site."
      />
      <HomepageEditor settings={content.settings} />
    </>
  );
}
