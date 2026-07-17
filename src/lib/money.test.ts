import { describe, it, expect } from "vitest";
import { Money } from "./money";

describe("Money Value Object", () => {
  it("should initialize from cents", () => {
    const m = Money.fromCents(1500);
    expect(m.cents).toBe(1500);
  });

  it("should initialize from INR", () => {
    const m = Money.fromInr(15.99);
    expect(m.cents).toBe(1599);
  });

  it("should add amounts correctly", () => {
    const m1 = Money.fromCents(1000);
    const m2 = Money.fromCents(500);
    expect(m1.add(m2).cents).toBe(1500);
  });

  it("should subtract amounts correctly", () => {
    const m1 = Money.fromCents(1000);
    const m2 = Money.fromCents(300);
    expect(m1.subtract(m2).cents).toBe(700);
  });

  it("should multiply amounts and round properly", () => {
    const m1 = Money.fromCents(1000); // 10.00
    expect(m1.multiply(0.15).cents).toBe(150); // 15% -> 1.50
    expect(m1.multiply(0.333).cents).toBe(333); // 3.33
  });
  
  it("should calculate percentages correctly", () => {
    const m1 = Money.fromCents(1000);
    expect(m1.percentage(15).cents).toBe(150);
  });

  it("should compare amounts correctly", () => {
    const m1 = Money.fromCents(1000);
    const m2 = Money.fromCents(1000);
    const m3 = Money.fromCents(1500);

    expect(m1.equals(m2)).toBe(true);
    expect(m1.equals(m3)).toBe(false);
    expect(m3.greaterThan(m1)).toBe(true);
    expect(m1.lessThan(m3)).toBe(true);
  });

  it("should format to INR string", () => {
    const m = Money.fromCents(129900);
    // Note: Node's Intl implementation output may vary slightly with spaces, 
    // but should contain ₹ and 1,299.00
    const formatted = m.format();
    expect(formatted).toContain("₹");
    expect(formatted).toContain("1,299.00");
  });

  it("should throw on invalid values", () => {
    expect(() => Money.fromCents(15.5)).toThrowError();
    expect(() => Money.fromInr(NaN)).toThrowError();
  });
});
