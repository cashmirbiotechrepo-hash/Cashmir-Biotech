import { describe, expect, it } from "vitest";
import { buildOrderShippedMail, buildOrderConfirmedMail } from "./transactional";

describe("transactional emails", () => {
  it("builds shipped mail with Orders from-display and short subject", () => {
    const mail = buildOrderShippedMail({
      customerName: "Moalim",
      orderNumber: "CB-TEST-1",
      confirmationToken: "tok",
      carrier: "Blue Dart",
      trackingNumber: "1228928738",
      items: [
        {
          productName: "Magic Food TaxO",
          quantity: 1,
          unitPriceCents: 35000,
          sizeLabel: "250 g",
          imageUrl: "/products/magic-food-taxo.png"
        }
      ],
      shippingAddress: {
        fullName: "Moalim Javeed",
        line1: "Methan Chanapora",
        city: "Srinagar",
        postalCode: "190015"
      },
      subtotalCents: 35000,
      shippingCents: 6000,
      totalCents: 41000
    });

    expect(mail.fromDisplay).toBe("Cashmir Biotech Orders");
    expect(mail.subject).toBe("Your order has shipped");
    expect(mail.html).toContain("Shipment confirmed");
    expect(mail.html).toContain("Track shipment");
    expect(mail.html).toContain("1228928738");
    expect(mail.html).toContain("Quality assurance");
    expect(mail.html).not.toContain("Cashmir Biotech Security");
  });

  it("builds confirmation mail", () => {
    const mail = buildOrderConfirmedMail({
      orderNumber: "CB-TEST-2",
      confirmationToken: "tok2",
      items: [{ productName: "Magic Food TaxO", quantity: 1, unitPriceCents: 35000 }],
      shippingCents: 0,
      totalCents: 35000
    });
    expect(mail.subject).toBe("Order confirmed");
    expect(mail.fromDisplay).toBe("Cashmir Biotech Orders");
  });
});
