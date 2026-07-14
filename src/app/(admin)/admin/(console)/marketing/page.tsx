import { AdminPageHeader } from "@/components/admin/page-header";
import { MarketingPanel } from "@/components/admin/marketing-panel";
import { listCampaigns, listCoupons } from "@/modules/admin/services/phase2.service";

export const metadata = { title: "Marketing" };

export default async function AdminMarketingPage() {
  const [coupons, campaigns] = await Promise.all([listCoupons(), listCampaigns()]);

  return (
    <>
      <AdminPageHeader
        title="Marketing"
        description="Email campaigns to your subscriber list. Storefront coupon redemption is not live yet."
      />
      <MarketingPanel coupons={coupons} campaigns={campaigns} />
    </>
  );
}
