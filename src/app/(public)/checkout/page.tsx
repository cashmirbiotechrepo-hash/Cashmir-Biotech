import type { Metadata } from "next";
import { CheckoutView } from "@/components/shop/checkout-view";

export const metadata: Metadata = {
  title: "Secure checkout",
  description:
    "Complete your Cashmir Biotech research order — patent-backed formulations, GST invoice, Razorpay-secured payment."
};

export default function CheckoutPage() {
  return (
    <div className="pb-10">
      <CheckoutView />
    </div>
  );
}
