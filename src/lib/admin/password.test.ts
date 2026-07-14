import { describe, expect, it, beforeEach } from "vitest";
import { AdminPasswordService } from "./password";

describe("AdminPasswordService", () => {
  beforeEach(() => {
    process.env.PASSWORD_PEPPER = "test-secret-pepper-for-vitest-run-32chars";
  });

  it("should hash and verify a password correctly using pepper", () => {
    const password = "SuperSecretAdminPassword123!";
    const hash = AdminPasswordService.hash(password);

    expect(hash).not.toBe(password);
    expect(AdminPasswordService.verify(password, hash)).toBe(true);
    expect(AdminPasswordService.verify("WrongPassword!", hash)).toBe(false);
  });

  it("should compare strings in a timing safe manner", () => {
    expect(AdminPasswordService.timingSafeEqualStrings("hello", "hello")).toBe(true);
    expect(AdminPasswordService.timingSafeEqualStrings("hello", "world")).toBe(false);
    expect(AdminPasswordService.timingSafeEqualStrings("hello", "helloworld")).toBe(false);
  });

  it("should run dummyVerify without throwing", () => {
    expect(() => AdminPasswordService.dummyVerify()).not.toThrow();
  });
});
