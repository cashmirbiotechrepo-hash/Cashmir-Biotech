import { AdminPageHeader } from "@/components/admin/page-header";
import { TeamEditorList } from "@/components/admin/team-editor";
import { getDashboardContent } from "@/modules/cms/services/content.service";

export const metadata = { title: "Board" };

export default async function AdminTeamPage() {
  const content = await getDashboardContent();
  return (
    <>
      <AdminPageHeader title="Board" description="Manage leadership bios and roles on the public team page." />
      <TeamEditorList team={content.team} />
    </>
  );
}
