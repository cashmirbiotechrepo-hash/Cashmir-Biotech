import { compactDecrypt } from "jose";

const DEV_ENCRYPTION_KEY = "dev-encryption-key-32-chars-lo!!";

function encryptionKeyBytes(): Uint8Array | null {
  const keyString = process.env.ENCRYPTION_KEY ?? DEV_ENCRYPTION_KEY;
  const keyBytes = new TextEncoder().encode(keyString);
  if (keyBytes.length !== 32) return null;
  return keyBytes;
}

/** Edge-safe JWE decrypt for middleware (no server-only imports). */
export async function decryptTokenEdge(ciphertext: string): Promise<string | null> {
  const key = encryptionKeyBytes();
  if (!key) return null;
  try {
    const { plaintext } = await compactDecrypt(ciphertext, key);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
