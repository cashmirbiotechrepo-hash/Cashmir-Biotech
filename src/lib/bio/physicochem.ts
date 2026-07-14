/**
 * Engine I — Physicochemical & composition calculators, implemented with the
 * published models (not crude one-liners).
 */

import { cleanSequence, baseComposition } from "@/lib/bio/sequences";

/* ------------------------------------------------------------------ */
/* DNA: nearest-neighbor melting temperature (SantaLucia 1998)        */
/* ------------------------------------------------------------------ */

// ΔH (kcal/mol) and ΔS (cal/mol·K) for each nearest-neighbor pair.
const NN: Record<string, { dH: number; dS: number }> = {
  AA: { dH: -7.9, dS: -22.2 }, AT: { dH: -7.2, dS: -20.4 }, TA: { dH: -7.2, dS: -21.3 },
  CA: { dH: -8.5, dS: -22.7 }, GT: { dH: -8.4, dS: -22.4 }, CT: { dH: -7.8, dS: -21.0 },
  GA: { dH: -8.2, dS: -22.2 }, CG: { dH: -10.6, dS: -27.2 }, GC: { dH: -9.8, dS: -24.4 },
  GG: { dH: -8.0, dS: -19.9 },
  // reverse-complement equivalents
  TT: { dH: -7.9, dS: -22.2 }, TG: { dH: -8.5, dS: -22.7 }, AC: { dH: -8.4, dS: -22.4 },
  AG: { dH: -7.8, dS: -21.0 }, TC: { dH: -8.2, dS: -22.2 }, CC: { dH: -8.0, dS: -19.9 }
};

const R = 1.987; // cal/(mol·K)

export type TmResult = {
  length: number;
  gcContent: number;
  tmNearestNeighbor: number;
  tmWallace: number;
  method: string;
};

/**
 * Nearest-neighbor Tm with salt correction. primerConc µM, Na+ mM.
 * Falls back to the Wallace rule only as a comparison, never as the primary.
 */
export function meltingTemperature(seq: string, primerConcUM = 500, naMM = 50): TmResult {
  const s = cleanSequence(seq).replace(/U/g, "T");
  let dH = 0.2; // initiation (approx, kcal/mol)
  let dS = -5.7;
  for (let i = 0; i + 2 <= s.length; i++) {
    const pair = s.slice(i, i + 2);
    const nn = NN[pair];
    if (nn) {
      dH += nn.dH;
      dS += nn.dS;
    }
  }
  const ct = primerConcUM * 1e-6;
  // Basic Tm (1 M Na+), then salt-adjust (Owczarzy-style simplification).
  let tm = (dH * 1000) / (dS + R * Math.log(ct / 4)) - 273.15;
  const na = naMM / 1000;
  tm = tm + 16.6 * Math.log10(na);

  const comp = baseComposition(s);
  const gc = comp.counts.G ?? 0;
  const cc = comp.counts.C ?? 0;
  const at = (comp.counts.A ?? 0) + (comp.counts.T ?? 0);
  const wallace = 4 * (gc + cc) + 2 * at;

  return {
    length: s.length,
    gcContent: Math.round(comp.gcContent * 1000) / 10,
    tmNearestNeighbor: Math.round(tm * 10) / 10,
    tmWallace: wallace,
    method: "SantaLucia 1998 nearest-neighbor + salt correction"
  };
}

/* ------------------------------------------------------------------ */
/* DNA molecular weight                                                */
/* ------------------------------------------------------------------ */

const DNA_MONO: Record<string, number> = { A: 313.21, T: 304.2, G: 329.21, C: 289.18 };

export function dnaMolecularWeight(seq: string, stranded: "ss" | "ds" = "ss") {
  const s = cleanSequence(seq).replace(/U/g, "T");
  let mw = 0;
  for (const c of s) mw += DNA_MONO[c] ?? 0;
  mw += 79; // 5' triphosphate / terminal correction (approx)
  if (stranded === "ds") mw *= 2;
  return Math.round(mw * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Protein: MW, pI, extinction coefficient, composition, hydropathy   */
/* ------------------------------------------------------------------ */

const AA_MONO: Record<string, number> = {
  A: 71.0788, R: 156.1875, N: 114.1038, D: 115.0886, C: 103.1388, E: 129.1155,
  Q: 128.1307, G: 57.0519, H: 137.1411, I: 113.1594, L: 113.1594, K: 128.1741,
  M: 131.1926, F: 147.1766, P: 97.1167, S: 87.0782, T: 101.1051, W: 186.2132,
  Y: 163.176, V: 99.1326
};

const WATER = 18.01524;

// pKa values (EMBOSS) for side chains and termini.
const PKA = { Nterm: 8.6, Cterm: 3.6, C: 8.5, D: 3.9, E: 4.1, H: 6.5, K: 10.8, R: 12.5, Y: 10.1 };

const KYTE_DOOLITTLE: Record<string, number> = {
  A: 1.8, R: -4.5, N: -3.5, D: -3.5, C: 2.5, Q: -3.5, E: -3.5, G: -0.4, H: -3.2,
  I: 4.5, L: 3.8, K: -3.9, M: 1.9, F: 2.8, P: -1.6, S: -0.8, T: -0.7, W: -0.9, Y: -1.3, V: 4.2
};

export type ProteinProps = {
  length: number;
  molecularWeight: number;
  isoelectricPoint: number;
  extinctionCoefficient: { reduced: number; oxidized: number };
  aromaticity: number;
  gravy: number;
  composition: { residue: string; count: number; percent: number }[];
};

function netCharge(counts: Record<string, number>, pH: number): number {
  const pos = (pk: number) => 1 / (1 + Math.pow(10, pH - pk));
  const neg = (pk: number) => 1 / (1 + Math.pow(10, pk - pH));
  let charge = pos(PKA.Nterm) - neg(PKA.Cterm);
  charge += (counts.K ?? 0) * pos(PKA.K);
  charge += (counts.R ?? 0) * pos(PKA.R);
  charge += (counts.H ?? 0) * pos(PKA.H);
  charge -= (counts.D ?? 0) * neg(PKA.D);
  charge -= (counts.E ?? 0) * neg(PKA.E);
  charge -= (counts.C ?? 0) * neg(PKA.C);
  charge -= (counts.Y ?? 0) * neg(PKA.Y);
  return charge;
}

export function proteinProperties(seq: string): ProteinProps {
  const s = cleanSequence(seq).replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, "");
  const counts: Record<string, number> = {};
  for (const c of s) counts[c] = (counts[c] ?? 0) + 1;
  const length = s.length || 1;

  let mw = WATER;
  for (const c of s) mw += AA_MONO[c] ?? 0;

  // Isoelectric point via bisection over pH 0–14.
  let lo = 0;
  let hi = 14;
  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    if (netCharge(counts, mid) > 0) lo = mid;
    else hi = mid;
  }
  const pI = (lo + hi) / 2;

  // Extinction coefficient (Gill & von Hippel / Edelhoch) at 280 nm.
  const nW = counts.W ?? 0;
  const nY = counts.Y ?? 0;
  const nC = counts.C ?? 0;
  const reduced = nW * 5500 + nY * 1490;
  const oxidized = reduced + Math.floor(nC / 2) * 125;

  const aromatic = (counts.F ?? 0) + (counts.W ?? 0) + (counts.Y ?? 0);
  let gravySum = 0;
  for (const c of s) gravySum += KYTE_DOOLITTLE[c] ?? 0;

  const composition = Object.keys(AA_MONO)
    .map((res) => ({
      residue: res,
      count: counts[res] ?? 0,
      percent: Math.round(((counts[res] ?? 0) / length) * 1000) / 10
    }))
    .sort((a, b) => b.count - a.count);

  return {
    length: s.length,
    molecularWeight: Math.round(mw * 100) / 100,
    isoelectricPoint: Math.round(pI * 100) / 100,
    extinctionCoefficient: { reduced, oxidized },
    aromaticity: Math.round((aromatic / length) * 1000) / 10,
    gravy: Math.round((gravySum / length) * 1000) / 1000,
    composition
  };
}

/** Kyte-Doolittle hydrophobicity profile (sliding window). */
export function hydrophobicityProfile(seq: string, window = 9) {
  const s = cleanSequence(seq).replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, "");
  const half = Math.floor(window / 2);
  const points: { position: number; score: number }[] = [];
  for (let i = half; i < s.length - half; i++) {
    let sum = 0;
    for (let j = i - half; j <= i + half; j++) sum += KYTE_DOOLITTLE[s[j]] ?? 0;
    points.push({ position: i + 1, score: Math.round((sum / window) * 100) / 100 });
  }
  return points;
}
