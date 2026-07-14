import { describe, expect, it, beforeEach } from "vitest";
import { createHash } from "crypto";
import { generatePoWChallenge, verifyPoW } from "./pow";

describe("PoW Challenge & Verification", () => {
  beforeEach(() => {
    process.env.POW_SECRET = "test-pow-hmac-secret-for-vitest";
    process.env.POW_DIFFICULTY = "3";
    // NODE_ENV is read-only under TS; vitest already runs in test.
  });

  it("should generate a valid challenge with required properties", async () => {
    const challenge = await generatePoWChallenge(3);
    expect(challenge.challenge).toHaveLength(64);
    expect(challenge.difficulty).toBe(3);
    expect(typeof challenge.timestamp).toBe("number");
    expect(challenge.signature).toBeDefined();
  });

  it("should verify a solved challenge and reject reuse", async () => {
    const challengeObj = await generatePoWChallenge(3);

    // Solve PoW for difficulty 3
    let nonce = 0;
    const prefix = "0".repeat(3);
    while (true) {
      const hash = createHash("sha256").update(`${challengeObj.challenge}${nonce}`).digest("hex");
      if (hash.startsWith(prefix)) break;
      nonce++;
    }

    const payload = {
      challenge: challengeObj.challenge,
      nonce,
      timestamp: challengeObj.timestamp,
      signature: challengeObj.signature,
      difficulty: challengeObj.difficulty
    };

    // First verification must succeed
    const valid = await verifyPoW(payload);
    expect(valid).toBe(true);

    // Second verification with the same challenge must fail (single-use enforcement)
    const reused = await verifyPoW(payload);
    expect(reused).toBe(false);
  });

  it("should reject an invalid nonce or tampered signature", async () => {
    const challengeObj = await generatePoWChallenge(3);

    const badNonce = await verifyPoW({
      challenge: challengeObj.challenge,
      nonce: 999999999,
      timestamp: challengeObj.timestamp,
      signature: challengeObj.signature,
      difficulty: challengeObj.difficulty
    });
    expect(badNonce).toBe(false);

    const badSig = await verifyPoW({
      challenge: challengeObj.challenge,
      nonce: 0,
      timestamp: challengeObj.timestamp,
      signature: "0000000000000000000000000000000000000000000000000000000000000000",
      difficulty: challengeObj.difficulty
    });
    expect(badSig).toBe(false);
  });
});
