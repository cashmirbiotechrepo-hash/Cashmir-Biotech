import type { Metadata } from "next";
import { CheckoutView } from "@/components/shop/checkout-view";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { getCustomerAddresses, getCustomerSecurityProfile } from "@/lib/customer/portal";
import { getShippingRates } from "@/modules/shop/services/order.service";

export const metadata: Metadata = {
  title: "Secure checkout",
  description:
    "Complete your Cashmir Biotech research order — patent-backed formulations, GST invoice, Razorpay-secured payment."
};

export default async function CheckoutPage() {
  const customer = await getCurrentCustomer();
  const [addresses, rates, profile] = await Promise.all([
    customer ? getCustomerAddresses(customer.id) : Promise.resolve([]),
    getShippingRates(),
    customer ? getCustomerSecurityProfile(customer.id) : Promise.resolve(null)
  ]);

  return (
    <div>
      <CheckoutView
        loggedIn={Boolean(customer)}
        prefillEmail={customer?.email ?? ""}
        prefillName={profile?.name ?? customer?.name ?? ""}
        prefillPhone={profile?.phone ?? ""}
        flatShippingInr={rates.flatShippingInr}
        freeShippingThresholdInr={rates.freeShippingThresholdInr}
        savedAddresses={addresses.map((a) => ({
          id: a.id,
          label: a.label,
          fullName: a.fullName,
          phone: a.phone,
          line1: a.line1,
          line2: a.line2,
          city: a.city,
          state: a.state,
          postalCode: a.postalCode,
          country: a.country,
          isDefault: a.isDefault
        }))}
      />
    </div>
  );
}
