import type { Metadata } from "next";
import { CartView } from "@/components/shop/cart-view";
import { listPatents } from "@/modules/cms/services/content.service";
import { getShippingRates } from "@/modules/shop/services/order.service";

export const metadata: Metadata = {
  title: "Your formula",
  description:
    "Confirm your Cashmir Biotech research order — patent-backed formulations, batch verification, secure checkout."
};

export default async function CartPage() {
  let patentCount = 0;
  let flatShippingInr = 60;
  let freeShippingThresholdInr = 999;
  try {
    const [patents, rates] = await Promise.all([listPatents(), getShippingRates()]);
    patentCount = patents.length;
    flatShippingInr = rates.flatShippingInr;
    freeShippingThresholdInr = rates.freeShippingThresholdInr;
  } catch {
    patentCount = 0;
  }

  return (
    <div className="pb-20">
      <CartView
        patentCount={patentCount}
        flatShippingInr={flatShippingInr}
        freeShippingThresholdInr={freeShippingThresholdInr}
      />
    </div>
  );
}
