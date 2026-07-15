import { AdminPageHeader } from "@/components/admin/page-header";
import { ShippingSettingsForm } from "@/components/admin/shipping-settings-form";
import { getShippingSettings } from "@/modules/cms/services/content.service";

export const metadata = { title: "Shipping" };

export default async function AdminShippingPage() {
  const settings = await getShippingSettings();

  return (
    <>
      <AdminPageHeader
        title="Shipping"
        description="Set the store-wide delivery fee and free-shipping threshold. Override per order from the order workspace when needed."
      />
      <ShippingSettingsForm
        flatShippingInr={settings.flatShippingInr}
        freeShippingThresholdInr={settings.freeShippingThresholdInr}
      />
    </>
  );
}
