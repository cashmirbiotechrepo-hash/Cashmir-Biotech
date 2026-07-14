/** Client-side PoW solver — runs in the browser before login submit. */
export async function solvePoWChallenge(challenge: string, difficulty = 4): Promise<number> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return -1;
  }

  let nonce = 0;
  const prefix = "0".repeat(difficulty);

  while (true) {
    if (nonce % 1000 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const input = `${challenge}${nonce}`;
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (hashHex.startsWith(prefix)) return nonce;
    nonce++;
  }
}
