import "server-only";
import { CompactEncrypt, compactDecrypt } from "jose";
import { getEncryptionKeyBytes } from "@/lib/admin/secrets";

export async function encryptToken(plaintext: string): Promise<string> {
  if (!plaintext) throw new Error("Cannot encrypt empty token");
  return new CompactEncrypt(new TextEncoder().encode(plaintext))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(getEncryptionKeyBytes());
}

export async function decryptToken(ciphertext: string): Promise<string> {
  if (!ciphertext) throw new Error("Cannot decrypt empty token");
  const { plaintext } = await compactDecrypt(ciphertext, getEncryptionKeyBytes());
  return new TextDecoder().decode(plaintext);
}
