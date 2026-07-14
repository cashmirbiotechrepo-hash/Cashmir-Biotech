import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { compareSync, hashSync } from "bcryptjs";
import { getPasswordPepper } from "@/lib/admin/secrets";

const BCRYPT_ROUNDS = 12;

function applyPepper(password: string): string {
  const pepper = getPasswordPepper();
  return createHmac("sha256", pepper).update(password).digest("hex");
}

/** Legacy env-admin hashes used bcrypt(password) without pepper — detect by re-hash path in verify. */
function applyLegacyPepper(password: string): string {
  return password;
}

export class AdminPasswordService {
  static hash(password: string): string {
    return hashSync(applyPepper(password), BCRYPT_ROUNDS);
  }

  static verify(password: string, hashValue: string): boolean {
    if (!hashValue) return false;
    const peppered = applyPepper(password);
    if (compareSync(peppered, hashValue)) return true;
    // Legacy: bcrypt of raw password (migrated env ADMIN_PASSWORD_HASH)
    return compareSync(applyLegacyPepper(password), hashValue);
  }

  /** Run a dummy hash to equalize timing when user is unknown. */
  static dummyVerify(): void {
    compareSync(applyPepper("dummy-timing-password"), hashSync("x", BCRYPT_ROUNDS));
  }

  static needsPepperUpgrade(password: string, hashValue: string): boolean {
    if (compareSync(applyPepper(password), hashValue)) return false;
    return compareSync(applyLegacyPepper(password), hashValue);
  }

  static timingSafeEqualStrings(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
