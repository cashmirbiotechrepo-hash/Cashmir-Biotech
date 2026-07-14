/**
 * Engine A — Pairwise alignment via dynamic programming with affine gap
 * penalties (Gotoh's algorithm). Supports global (Needleman-Wunsch) and local
 * (Smith-Waterman) modes.
 */

import { cleanSequence } from "@/lib/bio/sequences";
import { MATRICES, type ScoreMatrix } from "@/lib/bio/matrices";

export type AlignMode = "global" | "local";

export type AlignParams = {
  seq1: string;
  seq2: string;
  mode?: AlignMode;
  matrix?: "blosum62" | "identity";
  gapOpen?: number;
  gapExtend?: number;
};

export type AlignResult = {
  mode: AlignMode;
  matrix: string;
  score: number;
  alignedSeq1: string;
  midline: string;
  alignedSeq2: string;
  length: number;
  identity: number;
  identityPct: number;
  similarity: number;
  similarityPct: number;
  gaps: number;
  /** 1-based inclusive coordinates of the aligned region within each input. */
  seq1Start: number;
  seq1End: number;
  seq2Start: number;
  seq2End: number;
};

const NEG_INF = -1e9;

export function pairwiseAlign(params: AlignParams): AlignResult {
  const a = cleanSequence(params.seq1);
  const b = cleanSequence(params.seq2);
  const mode: AlignMode = params.mode ?? "global";
  const matrix: ScoreMatrix = MATRICES[params.matrix ?? "identity"] ?? MATRICES.identity;
  const gapOpen = params.gapOpen ?? -10;
  const gapExtend = params.gapExtend ?? -1;

  const n = a.length;
  const m = b.length;

  // Three matrices: M (match/mismatch), X (gap in b), Y (gap in a).
  const M: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(NEG_INF));
  const X: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(NEG_INF));
  const Y: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(NEG_INF));
  // Traceback pointers for M: 0=diag(M),1=fromX,2=fromY,-1=stop(local).
  const ptr: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  M[0][0] = 0;
  if (mode === "global") {
    for (let i = 1; i <= n; i++) X[i][0] = gapOpen + (i - 1) * gapExtend;
    for (let j = 1; j <= m; j++) Y[0][j] = gapOpen + (j - 1) * gapExtend;
  } else {
    for (let i = 0; i <= n; i++) M[i][0] = 0;
    for (let j = 0; j <= m; j++) M[0][j] = 0;
  }

  let best = mode === "local" ? 0 : NEG_INF;
  let bestI = 0;
  let bestJ = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = matrix.get(a[i - 1], b[j - 1]);

      X[i][j] = Math.max(M[i - 1][j] + gapOpen, X[i - 1][j] + gapExtend);
      Y[i][j] = Math.max(M[i][j - 1] + gapOpen, Y[i][j - 1] + gapExtend);

      const diag = Math.max(M[i - 1][j - 1], X[i - 1][j - 1], Y[i - 1][j - 1]) + s;
      let cell = diag;
      let p = M[i - 1][j - 1] >= X[i - 1][j - 1] && M[i - 1][j - 1] >= Y[i - 1][j - 1] ? 0 : X[i - 1][j - 1] >= Y[i - 1][j - 1] ? 1 : 2;

      const best3 = Math.max(diag, X[i][j], Y[i][j]);
      if (mode === "local") {
        if (best3 < 0) {
          cell = 0;
          p = -1;
        } else {
          cell = best3;
          p = best3 === diag ? p : best3 === X[i][j] ? 3 : 4;
        }
      } else {
        cell = best3;
        p = best3 === diag ? p : best3 === X[i][j] ? 3 : 4;
      }
      M[i][j] = cell;

      if (mode === "local" && cell >= best) {
        best = cell;
        bestI = i;
        bestJ = j;
      }
      ptr[i][j] = p;
    }
  }

  let i = mode === "global" ? n : bestI;
  let j = mode === "global" ? m : bestJ;
  if (mode === "global") {
    best = Math.max(M[n][m], X[n][m], Y[n][m]);
  }
  const endI = i;
  const endJ = j;

  let al1 = "";
  let al2 = "";

  // Traceback: for simplicity walk via M-cell decisions plateauing to gap runs.
  const inGap = (state: "X" | "Y", ci: number, cj: number) => {
    if (state === "X") {
      // gap in b: consume a[i]
      al1 = a[ci - 1] + al1;
      al2 = "-" + al2;
    } else {
      al1 = "-" + al1;
      al2 = b[cj - 1] + al2;
    }
  };

  while (i > 0 && j > 0) {
    if (mode === "local" && M[i][j] === 0) break;
    const p = ptr[i][j];
    if (p === 0 || p === 1 || p === 2) {
      al1 = a[i - 1] + al1;
      al2 = b[j - 1] + al2;
      i--;
      j--;
    } else if (p === 3) {
      inGap("X", i, j);
      i--;
    } else if (p === 4) {
      inGap("Y", i, j);
      j--;
    } else {
      break;
    }
  }

  const startI = i;
  const startJ = j;
  if (mode === "global") {
    while (i > 0) {
      al1 = a[i - 1] + al1;
      al2 = "-" + al2;
      i--;
    }
    while (j > 0) {
      al1 = "-" + al1;
      al2 = b[j - 1] + al2;
      j--;
    }
  }

  // Build midline + metrics.
  let identical = 0;
  let similar = 0;
  let gaps = 0;
  let midline = "";
  for (let k = 0; k < al1.length; k++) {
    const c1 = al1[k];
    const c2 = al2[k];
    if (c1 === "-" || c2 === "-") {
      gaps++;
      midline += " ";
    } else if (c1 === c2) {
      identical++;
      similar++;
      midline += "|";
    } else if (matrix.get(c1, c2) > 0) {
      similar++;
      midline += ":";
    } else {
      midline += " ";
    }
  }

  const len = al1.length || 1;
  return {
    mode,
    matrix: matrix.name,
    score: best === NEG_INF ? 0 : Math.round(best * 10) / 10,
    alignedSeq1: al1,
    midline,
    alignedSeq2: al2,
    length: al1.length,
    identity: identical,
    identityPct: Math.round((identical / len) * 1000) / 10,
    similarity: similar,
    similarityPct: Math.round((similar / len) * 1000) / 10,
    gaps,
    seq1Start: mode === "global" ? 1 : startI + 1,
    seq1End: endI,
    seq2Start: mode === "global" ? 1 : startJ + 1,
    seq2End: endJ
  };
}
