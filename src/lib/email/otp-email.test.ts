import { describe, expect, it } from "vitest";
import { buildOtpEmail, formatOtpCode, maskEmail } from "./otp-email";

describe("otp-email", () => {
  it("formats and masks helpers", () => {
    expect(formatOtpCode("537245")).toBe("537 245");
    expect(maskEmail("moalim@gmail.com")).toBe("mo***@gmail.com");
  });

  it("builds a short portal login email with prominent code", () => {
    const mail = buildOtpEmail({
      kind: "portal_login",
      code: "537245",
      email: "customer@example.com"
    });
    expect(mail.fromDisplay).toContain("Customer Portal");
    expect(mail.html).toContain("537 245");
    expect(mail.html).toContain("Valid for 10 minutes");
    expect(mail.html).toContain("Open Customer Portal");
    expect(mail.html).toContain('width="48"');
    expect(mail.html).not.toContain("Order history");
    expect(mail.html).not.toContain("ONE TIME");
    expect(mail.text).toContain("Cashmir Biotech");
    expect(mail.subject).toMatch(/verification code/i);
  });

  it("builds admin and order lookup variants", () => {
    const admin = buildOtpEmail({ kind: "admin_2fa", code: "111222", email: "admin@cashmirbiotech.com" });
    expect(admin.fromDisplay).toContain("Security");
    expect(admin.html).toContain("Open Operations Console");

    const lookup = buildOtpEmail({
      kind: "order_lookup",
      code: "333444",
      email: "buyer@example.com",
      orderNumber: "CB-123456"
    });
    expect(lookup.subject).toContain("CB-123456");
    expect(lookup.html).toContain("Open order lookup");
  });
});
