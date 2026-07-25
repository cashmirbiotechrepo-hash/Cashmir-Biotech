import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { resolveCheckoutAddressMutation } from "@/lib/customer/checkout-address-mutation";
import { parseIndianMobile } from "@/lib/customer/phone-in";

/**
 * Automated coverage for docs/portal-account-plan.md §8.4.
 * Items that need a browser/staging DB remain marked [manual] in the plan;
 * this suite locks the behaviors that are pure or policy-encoded.
 */

describe("§8.4 automated — consent / upsert / chip", () => {
  const shipping = {
    fullName: "Test",
    phone: "9876543210",
    line1: "1 Road",
    line2: "",
    city: "Srinagar",
    state: "JK",
    postalCode: "190001",
    country: "India"
  };

  it("unchecked save → no insert", () => {
    expect(
      resolveCheckoutAddressMutation({
        saveAddress: false,
        selectedAddressId: null,
        label: "Home",
        shipping,
        selectedSnapshot: null
      }).kind
    ).toBe("none");
  });

  it("chip dirty → fork upsert (does not label_only original)", () => {
    const m = resolveCheckoutAddressMutation({
      saveAddress: true,
      selectedAddressId: "a1",
      label: "Home",
      shipping: { ...shipping, line1: "2 Road" },
      selectedSnapshot: { ...shipping, label: "Home" }
    });
    expect(m.kind).toBe("upsert");
  });

  it("Other label without custom text blocked at checkout client", () => {
    const checkout = readFileSync(
      path.join(process.cwd(), "src/components/shop/checkout-view.tsx"),
      "utf8"
    );
    expect(checkout).toContain('labelPreset === "Other"');
    expect(checkout).toContain("labelCustom.trim()");
    expect(checkout).toContain("Enter a custom label");
  });
});

describe("§8.4 automated — phone / nav / sync / marketing", () => {
  it("shared Indian mobile validator", () => {
    expect(parseIndianMobile("9876543210").ok).toBe(true);
  });

  it("storefront account control is not lg-only", () => {
    const nav = readFileSync(
      path.join(process.cwd(), "src/components/experience/site-nav.tsx"),
      "utf8"
    );
    expect(nav).not.toMatch(/hidden[^"]*lg:inline-flex[^"]*Account/);
    expect(nav).toMatch(/accountInitials|Sign in/);
    expect(nav).toMatch(/\/portal\/login\?next=/);
  });

  it("portal mobile Store → /", () => {
    const shell = readFileSync(
      path.join(process.cwd(), "src/components/portal/portal-shell.tsx"),
      "utf8"
    );
    expect(shell).toContain('aria-label="Store home"');
    expect(shell).toContain('href="/"');
    expect(shell).toContain('label: "Overview"');
    expect(shell).toContain('href: "/portal/account"');
  });

  it("fingerprint unique + accountSyncedAt in schema", () => {
    const schema = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/accountSyncedAt/);
    expect(schema).toMatch(/fingerprint/);
    expect(schema).toMatch(/@@unique\(\[customerId,\s*fingerprint\]\)/);
    expect(schema).toMatch(/CustomerAddress_customerId_isDefault_uidx/);
    expect(schema).toMatch(/notifyMarketing/);
    expect(schema).toMatch(/addressClaimPromptDismissedAt/);
  });

  it("campaign send uses marketing prefs helper", () => {
    const phase2 = readFileSync(
      path.join(process.cwd(), "src/app/(admin)/admin/(console)/phase2-actions.ts"),
      "utf8"
    );
    expect(phase2).toMatch(/listMarketingRecipientEmails/);
  });

  it("fingerprint migrations split backfill vs merge+unique with gate", () => {
    const backfill = readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260725120000_account_address_fingerprint/migration.sql"
      ),
      "utf8"
    );
    const merge = readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260725121000_account_address_fingerprint_merge_unique/migration.sql"
      ),
      "utf8"
    );
    expect(backfill).toMatch(/OPERATIONAL GATE/);
    expect(backfill).not.toMatch(/DELETE FROM "CustomerAddress"/);
    expect(backfill).not.toMatch(/UNIQUE INDEX.*fingerprint/i);
    expect(merge).toMatch(/GATE/);
    expect(merge).toMatch(/DELETE FROM "CustomerAddress"/);
    expect(merge).toMatch(/UNIQUE INDEX.*fingerprint/i);
  });

  it("overview does not link guest orders on every read", () => {
    const portal = readFileSync(path.join(process.cwd(), "src/lib/customer/portal.ts"), "utf8");
    expect(portal).not.toMatch(/linkGuestOrdersToCustomer/);
    const auth = readFileSync(path.join(process.cwd(), "src/lib/customer/auth.ts"), "utf8");
    expect(auth).toMatch(/linkGuestOrdersToCustomer\(customer\.id,\s*email\)/);
  });
});
