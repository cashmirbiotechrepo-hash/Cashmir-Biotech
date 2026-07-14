/**
 * Engine B — BLAST-family heuristic search (seed → ungapped extend → gapped
 * extend) with Karlin-Altschul E-value statistics. A faithful, from-scratch
 * implementation for interactive-scale inputs (not a wrapper).
 */

import { cleanSequence, parseFasta } from "@/lib/bio/sequences";
import { sixFrameTranslation } from "@/lib/bio/codons";
import { BLOSUM62, dnaIdentityMatrix, type ScoreMatrix } from "@/lib/bio/matrices";
import { pairwiseAlign } from "@/lib/bio/alignment";
import { bitScore, eValue, karlinParams, type KarlinParams } from "@/lib/bio/karlin-altschul";

export type BlastProgram = "blastn" | "blastp" | "blastx" | "tblastn" | "tblastx";

export type BlastParams = {
  query: string;
  program: BlastProgram;
  database: string; // FASTA of subject sequences
  evalue?: number;
  wordSize?: number;
  reward?: number; // nucleotide match
  penalty?: number; // nucleotide mismatch
  gapOpen?: number;
  gapExtend?: number;
  maxHits?: number;
  neighborThreshold?: number; // protein neighborhood word threshold T
};

export type BlastHit = {
  subjectId: string;
  subjectDef: string;
  program: BlastProgram;
  queryFrame: number;
  queryStrand: "+" | "-";
  subjectFrame: number;
  score: number;
  bitScore: number;
  eValue: number;
  eValueText: string;
  identity: number;
  identityPct: number;
  positives: number;
  positivesPct: number;
  gaps: number;
  alignmentLength: number;
  queryStart: number;
  queryEnd: number;
  subjectStart: number;
  subjectEnd: number;
  queryAlignment: string;
  midline: string;
  subjectAlignment: string;
};

export type BlastResult = {
  program: BlastProgram;
  matrix: string;
  wordSize: number;
  statistics: {
    lambda: number;
    k: number;
    source: string;
    queryLength: number;
    dbSequences: number;
    dbLength: number;
    effectiveSearchSpace: number;
  };
  hits: BlastHit[];
};

const AA = "ACDEFGHIKLMNPQRSTVWY".split("");

type Unit = { seq: string; frame: number; strand: "+" | "-" };

function isProteinProgram(p: BlastProgram) {
  return p === "blastp" || p === "blastx" || p === "tblastn" || p === "tblastx";
}

function queryUnits(query: string, program: BlastProgram): Unit[] {
  const q = cleanSequence(query);
  if (program === "blastp" || program === "tblastn") {
    return [{ seq: q.replace(/[^A-Z]/g, ""), frame: 0, strand: "+" }];
  }
  if (program === "blastn") {
    const fwd = q.replace(/U/g, "T");
    const rc = [...fwd].reverse().map((c) => ({ A: "T", T: "A", G: "C", C: "G" }[c] ?? "N")).join("");
    return [
      { seq: fwd, frame: 1, strand: "+" },
      { seq: rc, frame: 1, strand: "-" }
    ];
  }
  // blastx / tblastx — translate query in six frames
  return sixFrameTranslation(q).map((f) => ({ seq: f.protein, frame: f.frame, strand: f.strand }));
}

function subjectUnits(seq: string, program: BlastProgram): Unit[] {
  const s = cleanSequence(seq);
  if (program === "tblastn" || program === "tblastx") {
    return sixFrameTranslation(s).map((f) => ({ seq: f.protein, frame: f.frame, strand: f.strand }));
  }
  if (program === "blastn") return [{ seq: s.replace(/U/g, "T"), frame: 1, strand: "+" }];
  return [{ seq: s.replace(/[^A-Z]/g, ""), frame: 0, strand: "+" }];
}

/** Protein neighborhood words: same-length words scoring ≥ T against `word`. */
function neighborhood(word: string, matrix: ScoreMatrix, T: number): string[] {
  const out: string[] = [];
  const build = (pos: number, acc: string, score: number) => {
    if (pos === word.length) {
      if (score >= T) out.push(acc);
      return;
    }
    for (const a of AA) {
      build(pos + 1, acc + a, score + matrix.get(word[pos], a));
    }
  };
  build(0, "", 0);
  return out;
}

function buildIndex(query: string, wordSize: number, isProtein: boolean, matrix: ScoreMatrix, T: number) {
  const index = new Map<string, number[]>();
  for (let i = 0; i + wordSize <= query.length; i++) {
    const word = query.slice(i, i + wordSize);
    if (word.includes("*") || word.includes("X")) continue;
    const words = isProtein ? neighborhood(word, matrix, T) : [word];
    for (const w of words) {
      const arr = index.get(w);
      if (arr) arr.push(i);
      else index.set(w, [i]);
    }
  }
  return index;
}

function ungappedExtend(
  q: string,
  s: string,
  qPos: number,
  sPos: number,
  wordSize: number,
  matrix: ScoreMatrix,
  xDrop: number
) {
  // Right (includes the word).
  let score = 0;
  let best = 0;
  let bestOff = 0;
  for (let off = 0; qPos + off < q.length && sPos + off < s.length; off++) {
    score += matrix.get(q[qPos + off], s[sPos + off]);
    if (score > best) {
      best = score;
      bestOff = off + 1;
    }
    if (score <= best - xDrop) break;
  }
  const rightScore = best;
  const rightLen = Math.max(bestOff, wordSize);

  // Left.
  score = 0;
  best = 0;
  let leftLen = 0;
  for (let off = 1; qPos - off >= 0 && sPos - off >= 0; off++) {
    score += matrix.get(q[qPos - off], s[sPos - off]);
    if (score > best) {
      best = score;
      leftLen = off;
    }
    if (score <= best - xDrop) break;
  }

  return {
    score: best + rightScore,
    qFrom: qPos - leftLen,
    qTo: qPos + rightLen - 1,
    sFrom: sPos - leftLen,
    sTo: sPos + rightLen - 1
  };
}

export function blast(params: BlastParams): BlastResult {
  const program = params.program;
  const isProtein = isProteinProgram(program);
  const wordSize = params.wordSize ?? (isProtein ? 3 : 11);
  const reward = params.reward ?? 1;
  const penalty = params.penalty ?? -2;
  const gapOpen = params.gapOpen ?? (isProtein ? -11 : -5);
  const gapExtend = params.gapExtend ?? (isProtein ? -1 : -2);
  const eCutoff = params.evalue ?? 10;
  const maxHits = Math.min(params.maxHits ?? 50, 200);
  const T = params.neighborThreshold ?? 11;
  const xDrop = isProtein ? 7 : 20;

  const matrix: ScoreMatrix = isProtein ? BLOSUM62 : dnaIdentityMatrix(reward, penalty);
  const kp: KarlinParams = karlinParams({ isProtein, matrix, reward, penalty, gapped: true });

  const qUnits = queryUnits(params.query, program);
  const subjects = parseFasta(params.database);
  if (subjects.length === 0) {
    // Treat the whole database blob as a single unnamed subject.
    const raw = cleanSequence(params.database);
    if (raw) subjects.push({ id: "subject_1", description: "", sequence: raw });
  }

  // Effective search-space lengths.
  const qLenComparison = Math.max(...qUnits.map((u) => u.seq.length), 1);
  let dbResidues = 0;
  for (const s of subjects) {
    for (const u of subjectUnits(s.sequence, program)) dbResidues += u.seq.length;
  }
  const effectiveSpace = qLenComparison * dbResidues;

  // Pre-build query word indices per query unit.
  const indices = qUnits.map((u) => buildIndex(u.seq, wordSize, isProtein, matrix, T));

  const hits: BlastHit[] = [];

  for (const subject of subjects) {
    const sUnits = subjectUnits(subject.sequence, program);
    const perSubject: BlastHit[] = [];

    for (const sUnit of sUnits) {
      const s = sUnit.seq;
      for (let ui = 0; ui < qUnits.length; ui++) {
        const qUnit = qUnits[ui];
        const q = qUnit.seq;
        const index = indices[ui];

        // Collect ungapped HSP anchors from seed hits.
        const anchors: { qFrom: number; qTo: number; sFrom: number; sTo: number; score: number }[] = [];
        const seenDiag = new Set<number>();
        for (let p = 0; p + wordSize <= s.length; p++) {
          const word = s.slice(p, p + wordSize);
          const qPositions = index.get(word);
          if (!qPositions) continue;
          for (const qPos of qPositions) {
            const diag = p - qPos;
            // Coarse per-diagonal dedupe to avoid re-extending the same HSP.
            const diagKey = diag * 100000 + Math.floor(qPos / 20);
            if (seenDiag.has(diagKey)) continue;
            seenDiag.add(diagKey);
            const hsp = ungappedExtend(q, s, qPos, p, wordSize, matrix, xDrop);
            if (hsp.score > 0) anchors.push(hsp);
          }
        }

        anchors.sort((a, b) => b.score - a.score);

        // Gapped-refine the top anchors.
        for (const anchor of anchors.slice(0, 8)) {
          const margin = isProtein ? 12 : 30;
          const qLo = Math.max(0, anchor.qFrom - margin);
          const qHi = Math.min(q.length, anchor.qTo + margin + 1);
          const sLo = Math.max(0, anchor.sFrom - margin);
          const sHi = Math.min(s.length, anchor.sTo + margin + 1);

          const aln = pairwiseAlign({
            seq1: q.slice(qLo, qHi),
            seq2: s.slice(sLo, sHi),
            mode: "local",
            matrix: isProtein ? "blosum62" : "identity",
            gapOpen,
            gapExtend
          });
          if (aln.length === 0) continue;

          const score = Math.round(aln.score);
          const e = eValue(score, qLenComparison, dbResidues, kp);
          if (e > eCutoff) continue;

          const qStart = qLo + aln.seq1Start;
          const qEnd = qLo + aln.seq1End;
          const sStart = sLo + aln.seq2Start;
          const sEnd = sLo + aln.seq2End;

          perSubject.push({
            subjectId: subject.id || "subject",
            subjectDef: subject.description,
            program,
            queryFrame: qUnit.frame,
            queryStrand: qUnit.strand,
            subjectFrame: sUnit.frame,
            score,
            bitScore: Math.round(bitScore(score, kp) * 10) / 10,
            eValue: e,
            eValueText: e < 1e-4 ? e.toExponential(1) : e.toPrecision(2),
            identity: aln.identity,
            identityPct: aln.identityPct,
            positives: aln.similarity,
            positivesPct: aln.similarityPct,
            gaps: aln.gaps,
            alignmentLength: aln.length,
            queryStart: qStart,
            queryEnd: qEnd,
            subjectStart: sStart,
            subjectEnd: sEnd,
            queryAlignment: aln.alignedSeq1,
            midline: aln.midline,
            subjectAlignment: aln.alignedSeq2
          });
        }
      }
    }

    // Dedupe overlapping HSPs within a subject (keep the higher-scoring one).
    perSubject.sort((a, b) => b.score - a.score);
    const kept: BlastHit[] = [];
    for (const hit of perSubject) {
      const overlaps = kept.some(
        (k) =>
          k.queryStart <= hit.queryEnd &&
          hit.queryStart <= k.queryEnd &&
          k.subjectStart <= hit.subjectEnd &&
          hit.subjectStart <= k.subjectEnd
      );
      if (!overlaps) kept.push(hit);
    }
    hits.push(...kept);
  }

  hits.sort((a, b) => a.eValue - b.eValue || b.score - a.score);

  return {
    program,
    matrix: matrix.name,
    wordSize,
    statistics: {
      lambda: Math.round(kp.lambda * 1000) / 1000,
      k: kp.k,
      source: kp.source,
      queryLength: qLenComparison,
      dbSequences: subjects.length,
      dbLength: dbResidues,
      effectiveSearchSpace: effectiveSpace
    },
    hits: hits.slice(0, maxHits)
  };
}
