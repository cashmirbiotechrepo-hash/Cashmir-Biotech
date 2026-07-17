/**
 * A primitive-safe value object for handling currency amounts.
 * Prevents floating-point errors by storing the amount in cents (or equivalent smallest denomination).
 * Defaults to INR (Indian Rupee) where 1 INR = 100 Paise (cents).
 */
export class Money {
  private readonly _cents: number;

  private constructor(cents: number) {
    if (!Number.isSafeInteger(cents)) {
      throw new Error(`Invalid money amount: ${cents} is not a safe integer.`);
    }
    this._cents = cents;
  }

  /** Create a Money object from a cents/paise amount (e.g., 1500 for ₹15.00) */
  static fromCents(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new Error(`Invalid money amount: cents must be an integer.`);
    }
    return new Money(cents);
  }

  /** Create a Money object from a standard currency amount (e.g., 15.00 for ₹15.00) */
  static fromInr(inr: number): Money {
    if (!Number.isFinite(inr)) {
      throw new Error(`Invalid INR amount: ${inr}`);
    }
    return new Money(Math.round(inr * 100));
  }

  get cents(): number {
    return this._cents;
  }

  /** Add another Money amount */
  add(other: Money): Money {
    return new Money(this._cents + other._cents);
  }

  /** Subtract another Money amount */
  subtract(other: Money): Money {
    return new Money(this._cents - other._cents);
  }

  /** Multiply by a factor (e.g., for taxes or discounts). Rounds to nearest cent. */
  multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new Error(`Invalid multiplication factor: ${factor}`);
    }
    return new Money(Math.round(this._cents * factor));
  }
  
  /** Get percentage of the amount. Factor should be between 0 and 100. */
  percentage(percent: number): Money {
    return this.multiply(percent / 100);
  }

  /** Returns true if amounts are equal */
  equals(other: Money): boolean {
    return this._cents === other._cents;
  }

  /** Returns true if this amount is greater than other */
  greaterThan(other: Money): boolean {
    return this._cents > other._cents;
  }

  /** Returns true if this amount is less than other */
  lessThan(other: Money): boolean {
    return this._cents < other._cents;
  }

  /** Format to INR string (e.g., "₹1,299.00") */
  format(): string {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(this._cents / 100);
  }
}
