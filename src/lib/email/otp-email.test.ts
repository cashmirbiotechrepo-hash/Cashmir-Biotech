import { describe, expect, it } from "vitest";
import { buildOtpEmail, formatOtpCode, maskEmail } from "./otp-email";

describe("otp-email", () => {
  it("formats and masks helpers", () => {
    expect(formatOtpCode("537245")).toBe("537 245");
    expect(maskEmail("moalim@gmail.com")).toBe("mo***@gmail.com");
  });

  it("builds branded portal login email", () => {
    const mail = buildOtpEmail({
      kind: "portal_login",
      code: "537245",
      email: "customer@example.com"
    });
    expect(mail.fromDisplay).toContain("Customer Portal");
    expect(mail.html).toContain("537 245");
    expect(mail.html).toContain("Valid for");
    expect(mail.html).toContain("10 minutes");
    expect(mail.html).toContain("Continue to Customer Portal");
    expect(mail.text).toContain("CASHMIR BIOTECH");
    expect(mail.subject).toMatch(/Customer Portal/i);
  });

  it("builds admin and order lookup variants", () => {
    const admin = buildOtpEmail({ kind: "admin_2fa", code: "111222", email: "admin@cashmirbiotech.com" });
    expect(admin.fromDisplay).toContain("Security");
    expect(admin.html).toContain("Operations Console");

    const lookup = buildOtpEmail({
      kind: "order_lookup",
      code: "333444",
      email: "buyer@example.com",
      orderNumber: "CB-123456"
    });
    expect(lookup.subject).toContain("CB-123456");
    expect(lookup.html).toContain("Order Lookup");
  });
});
