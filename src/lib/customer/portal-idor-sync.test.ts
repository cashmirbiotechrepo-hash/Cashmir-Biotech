import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * IDOR / ownership policy tests — static + mocked helpers.
 * Ownership is enforced in portal actions via session.customerId scoping.
 */

describe("portal address IDOR policy (source)", () => {
  const actions = readFileSync(
    path.join(process.cwd(), "src/app/(portal)/portal/(session)/actions.ts"),
    "utf8"
  );

  it("scopes delete/setDefault/update through owned helpers", () => {
    expect(actions).toMatch(/deleteOwnedAddress\(customer\.id/);
    expect(actions).toMatch(/setOwnedDefaultAddress\(customer\.id/);
    expect(actions).toMatch(/updatePortalAddressFields\(customer\.id,\s*addressId/);
  });

  it("support tickets verify order ownership before create", () => {
    expect(actions).toMatch(/customerId:\s*customer\.id,\s*orderNumber/);
    expect(actions).toMatch(/That order was not found on your account/);
  });

  it("profile update is session-bound", () => {
    expect(actions).toMatch(/where:\s*\{\s*id:\s*customer\.id/);
    expect(actions).toContain("updateCustomerProfileAction");
  });
});

describe("account sync policy (source)", () => {
  const addresses = readFileSync(
    path.join(process.cwd(), "src/lib/customer/addresses.ts"),
    "utf8"
  );
  const orderState = readFileSync(
    path.join(process.cwd(), "src/modules/shop/services/order-state.service.ts"),
    "utf8"
  );

  it("uses advisory xact lock and accountSyncedAt gate", () => {
    expect(addresses).toMatch(/pg_advisory_xact_lock/);
    expect(addresses).toMatch(/\$\{orderId\}::text/);
    expect(addresses).toMatch(/accountSyncedAt/);
    expect(addresses).toMatch(/sync_status:\s*"unknown"/);
  });

  it("uses shared native upsert inside sync (no P2002 catch-in-tx)", () => {
    expect(addresses).toMatch(/upsertAddressWithinTx/);
    expect(addresses).toMatch(/customerId_fingerprint/);
    expect(addresses).toMatch(/customerAddress\.upsert/);
    // Must not continue the same interactive tx after catching P2002
    expect(addresses).not.toMatch(/if \(!isUniqueViolation\(err\)\) throw err/);
  });

  it("hooks syncWithBudget on markOrderPaid paths", () => {
    expect(orderState).toMatch(/syncWithBudget/);
    expect(orderState).toMatch(/ms:\s*400/);
  });

  it("payment verify + razorpay webhook call markOrderPaid via order.service facade", () => {
    const verify = readFileSync(
      path.join(process.cwd(), "src/app/api/payment/verify/route.ts"),
      "utf8"
    );
    const webhook = readFileSync(
      path.join(process.cwd(), "src/app/api/webhooks/razorpay/route.ts"),
      "utf8"
    );
    const facade = readFileSync(
      path.join(process.cwd(), "src/modules/shop/services/order.service.ts"),
      "utf8"
    );
    expect(verify).toMatch(/markOrderPaid/);
    expect(verify).toMatch(/order\.service/);
    expect(webhook).toMatch(/markOrderPaid/);
    expect(webhook).toMatch(/order\.service/);
    expect(facade).toMatch(/export \* from "\.\/order-state\.service"/);
    expect(facade).toMatch(/export \* from "\.\/checkout\.service"/);
  });
});

const mockFindFirst = vi.fn();
const mockUpdateMany = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    customerAddress: {
      findFirst: mockFindFirst,
      updateMany: mockUpdateMany,
      update: mockUpdate,
      delete: mockDelete,
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn(),
      findMany: vi.fn()
    }
  };
  return fn(tx);
});

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
    customerAddress: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args)
    }
  }
}));

describe("assertAddressOwned / deleteOwnedAddress IDOR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assertAddressOwned returns null for foreign address", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const { assertAddressOwned } = await import("@/lib/customer/addresses");
    const row = await assertAddressOwned("cust_a", "addr_other");
    expect(row).toBeNull();
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "addr_other", customerId: "cust_a" }
    });
  });

  it("deleteOwnedAddress no-ops when address not owned", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const { deleteOwnedAddress } = await import("@/lib/customer/addresses");
    await deleteOwnedAddress("cust_a", "addr_other");
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("updatePortalAddressFields rejects foreign id", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const { updatePortalAddressFields } = await import("@/lib/customer/addresses");
    const res = await updatePortalAddressFields("cust_a", "addr_other", {
      label: "Home",
      fullName: "A",
      phone: "9876543210",
      line1: "1 St",
      line2: "",
      city: "Srinagar",
      state: "JK",
      postalCode: "190001",
      country: "India"
    });
    expect(res).toEqual({ ok: false, error: "Address not found." });
  });
});

describe("syncWithBudget idempotency", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns ok immediately when accountSyncedAt already set", async () => {
    vi.doMock("@/lib/db", () => ({
      db: {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ord_1",
            accountSyncedAt: new Date(),
            customerId: "cust_1",
            customerEmail: "a@b.com"
          })
        }
      }
    }));
    const { syncWithBudget } = await import("@/lib/customer/addresses");
    await expect(syncWithBudget("ord_1")).resolves.toBe("ok");
  });
});
