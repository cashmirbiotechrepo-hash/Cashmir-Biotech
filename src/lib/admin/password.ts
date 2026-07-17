import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { compareSync, hashSync } from "bcryptjs";
import { getPasswordPepper } from "@/lib/admin/secrets";

const BCRYPT_ROUNDS = 12;

function applyPepper(password: string): string {
  const pepper = getPasswordPepper();
  return createHmac("sha256", pepper).update(password).digest("hex");
}

export class AdminPasswordService {
  static hash(password: string): string {
    return hashSync(applyPepper(password), BCRYPT_ROUNDS);
  }

  static verify(password: string, hashValue: string): boolean {
    if (!hashValue) return false;
    const peppered = applyPepper(password);
    return compareSync(peppered, hashValue);
  }

  /** Run a dummy hash to equalize timing when user is unknown. */
  static dummyVerify(): void {
    compareSync(applyPepper("dummy-timing-password"), hashSync("x", BCRYPT_ROUNDS));
  }

  static needsPepperUpgrade(password: string, hashValue: string): boolean {
    return false;
  }

  static timingSafeEqualStrings(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
