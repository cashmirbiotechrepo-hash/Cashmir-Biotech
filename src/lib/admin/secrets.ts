import "server-only";

const DEV_ENCRYPTION_KEY = "dev-encryption-key-32-chars-lo!!";
const DEV_PEPPER = "dev-only-insecure-pepper-32chars!";

export function getEncryptionKeyBytes(): Uint8Array {
  const keyString =
    process.env.ENCRYPTION_KEY ??
    (process.env.NODE_ENV === "production" ? undefined : DEV_ENCRYPTION_KEY);
  if (!keyString) {
    throw new Error("ENCRYPTION_KEY is required in production (exactly 32 bytes).");
  }
  const keyBytes = new TextEncoder().encode(keyString);
  if (keyBytes.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must be exactly 32 bytes; got ${keyBytes.length}.`);
  }
  return keyBytes;
}

export function getPasswordPepper(): string {
  const pepper =
    process.env.PASSWORD_PEPPER ??
    (process.env.NODE_ENV === "production" ? undefined : DEV_PEPPER);
  if (!pepper) {
    throw new Error("PASSWORD_PEPPER is required in production (≥32 chars).");
  }
  return pepper;
}
