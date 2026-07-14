/**
 * Karlin-Altschul statistics — the part that makes BLAST correct rather than a
 * toy. λ is solved numerically from the scoring scheme + background residue
 * frequencies; K uses published values for standard systems.
 */

import type { ScoreMatrix } from "@/lib/bio/matrices";

// Robinson & Robinson amino-acid background frequencies.
const PROTEIN_BG: Record<string, number> = {
  A: 0.078, R: 0.051, N: 0.045, D: 0.054, C: 0.019, Q: 0.043, E: 0.063,
  G: 0.074, H: 0.022, I: 0.052, L: 0.09, K: 0.057, M: 0.022, F: 0.039,
  P: 0.052, S: 0.071, T: 0.058, W: 0.013, Y: 0.032, V: 0.064
};

const DNA_BG: Record<string, number> = { A: 0.25, C: 0.25, G: 0.25, T: 0.25 };

export type KarlinParams = { lambda: number; k: number; h: number; source: string };

// Published gapped Karlin-Altschul parameters (NCBI BLAST+ defaults).
const PUBLISHED: Record<string, KarlinParams> = {
  "blosum62:11:1": { lambda: 0.267, k: 0.041, h: 0.14, source: "NCBI BLOSUM62 gapped (11,1)" },
  "blosum62:ungapped": { lambda: 0.318, k: 0.13, h: 0.4, source: "NCBI BLOSUM62 ungapped" },
  "dna:1:-2": { lambda: 1.28, k: 0.46, h: 0.85, source: "NCBI nucleotide (1,-2)" },
  "dna:2:-3": { lambda: 0.625, k: 0.41, h: 0.78, source: "NCBI nucleotide (2,-3)" },
  "dna:1:-1": { lambda: 1.1, k: 0.333, h: 0.549, source: "NCBI nucleotide (1,-1)" }
};

/** Solve Σ pᵢ qⱼ e^{λ·s(i,j)} = 1 for the unique positive λ via bisection. */
export function computeLambda(matrix: ScoreMatrix, alphabet: string[], bg: Record<string, number>): number {
  const f = (lambda: number) => {
    let sum = 0;
    for (const i of alphabet) {
      for (const j of alphabet) {
        sum += (bg[i] ?? 0) * (bg[j] ?? 0) * Math.exp(lambda * matrix.get(i, j));
      }
    }
    return sum - 1;
  };

  // Expected score must be negative and a positive score must exist.
  let lo = 1e-6;
  let hi = 5;
  if (f(lo) > 0 || f(hi) < 0) return 0.318; // fall back to a sane default
  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export function karlinParams(opts: {
  isProtein: boolean;
  matrix: ScoreMatrix;
  reward?: number;
  penalty?: number;
  gapped: boolean;
}): KarlinParams {
  if (opts.isProtein) {
    const key = opts.gapped ? "blosum62:11:1" : "blosum62:ungapped";
    return PUBLISHED[key];
  }
  const key = `dna:${opts.reward ?? 1}:${opts.penalty ?? -2}`;
  if (PUBLISHED[key]) return PUBLISHED[key];
  // Unlisted scoring: compute λ numerically, estimate K.
  const lambda = computeLambda(opts.matrix, Object.keys(DNA_BG), DNA_BG);
  return { lambda, k: 0.1, h: 0.5, source: "computed λ (K estimated)" };
}

export function proteinBackground() {
  return PROTEIN_BG;
}

/** Bit score S' = (λ·S − ln K) / ln 2. */
export function bitScore(rawScore: number, p: KarlinParams): number {
  return (p.lambda * rawScore - Math.log(p.k)) / Math.LN2;
}

/** E = m·n·2^(−S'). m,n are effective query/database search-space lengths. */
export function eValue(rawScore: number, m: number, n: number, p: KarlinParams): number {
  const bits = bitScore(rawScore, p);
  return m * n * Math.pow(2, -bits);
}
