import type { Metadata } from "next";
import { CartView } from "@/components/shop/cart-view";
import { listPatents } from "@/modules/cms/services/content.service";

export const metadata: Metadata = {
  title: "Your formula",
  description:
    "Confirm your Cashmir Biotech research order — patent-backed formulations, batch verification, secure checkout."
};

export default async function CartPage() {
  let patentCount = 0;
  try {
    const patents = await listPatents();
    patentCount = patents.length;
  } catch {
    patentCount = 0;
  }

  return (
    <div className="pb-20">
      <CartView patentCount={patentCount} />
    </div>
  );
}
