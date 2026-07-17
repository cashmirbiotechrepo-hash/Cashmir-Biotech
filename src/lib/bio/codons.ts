/** Codon table (standard genetic code), translation, and ORF finding. */

import { cleanSequence, reverseComplement } from "@/lib/bio/sequences";

// Standard genetic code (NCBI transl_table=1).
export const CODON_TABLE: Record<string, string> = {
  TTT: "F", TTC: "F", TTA: "L", TTG: "L",
  CTT: "L", CTC: "L", CTA: "L", CTG: "L",
  ATT: "I", ATC: "I", ATA: "I", ATG: "M",
  GTT: "V", GTC: "V", GTA: "V", GTG: "V",
  TCT: "S", TCC: "S", TCA: "S", TCG: "S",
  CCT: "P", CCC: "P", CCA: "P", CCG: "P",
  ACT: "T", ACC: "T", ACA: "T", ACG: "T",
  GCT: "A", GCC: "A", GCA: "A", GCG: "A",
  TAT: "Y", TAC: "Y", TAA: "*", TAG: "*",
  CAT: "H", CAC: "H", CAA: "Q", CAG: "Q",
  AAT: "N", AAC: "N", AAA: "K", AAG: "K",
  GAT: "D", GAC: "D", GAA: "E", GAG: "E",
  TGT: "C", TGC: "C", TGA: "*", TGG: "W",
  CGT: "R", CGC: "R", CGA: "R", CGG: "R",
  AGT: "S", AGC: "S", AGA: "R", AGG: "R",
  GGT: "G", GGC: "G", GGA: "G", GGG: "G"
};

/** Pack ACGT base charCode into 0..3; unknown → -1. */
function baseIndex(code: number): number {
  // A=65, C=67, G=71, T=84 (and a/c/g/t lowercase)
  switch (code) {
    case 65:
    case 97:
      return 0;
    case 67:
    case 99:
      return 1;
    case 71:
    case 103:
      return 2;
    case 84:
    case 116:
    case 85: // U
    case 117:
      return 3;
    default:
      return -1;
  }
}

/** Packed codon → amino acid table (4^3 = 64 slots). Built once from CODON_TABLE. */
const PACKED_CODONS: string[] = (() => {
  const table = new Array<string>(64).fill("X");
  const bases = ["A", "C", "G", "T"] as const;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        const codon = `${bases[i]}${bases[j]}${bases[k]}`;
        table[(i << 4) | (j << 2) | k] = CODON_TABLE[codon] ?? "X";
      }
    }
  }
  return table;
})();

function aminoAcidAt(seq: string, i: number): string {
  const a = baseIndex(seq.charCodeAt(i));
  const b = baseIndex(seq.charCodeAt(i + 1));
  const c = baseIndex(seq.charCodeAt(i + 2));
  if (a < 0 || b < 0 || c < 0) return "X";
  return PACKED_CODONS[(a << 4) | (b << 2) | c]!;
}

export function translate(seq: string, frame = 0): string {
  const s = cleanSequence(seq).replace(/U/g, "T");
  const start = frame;
  const parts: string[] = [];
  for (let i = start; i + 3 <= s.length; i += 3) {
    parts.push(aminoAcidAt(s, i));
  }
  return parts.join("");
}

export type FrameTranslation = { frame: number; strand: "+" | "-"; protein: string };

/** All six reading frames (three forward, three reverse-complement). */
export function sixFrameTranslation(seq: string): FrameTranslation[] {
  const fwd = cleanSequence(seq).replace(/U/g, "T");
  const rev = reverseComplement(fwd);
  const frames: FrameTranslation[] = [];
  for (let f = 0; f < 3; f++) frames.push({ frame: f + 1, strand: "+", protein: translate(fwd, f) });
  for (let f = 0; f < 3; f++) frames.push({ frame: f + 1, strand: "-", protein: translate(rev, f) });
  return frames;
}

export type Orf = {
  strand: "+" | "-";
  frame: number;
  start: number;
  end: number;
  length: number;
  protein: string;
};

/** Find open reading frames (ATG…stop) across all six frames. */
export function findOrfs(seq: string, minAminoAcids = 30): Orf[] {
  const fwd = cleanSequence(seq).replace(/U/g, "T");
  const rev = reverseComplement(fwd);
  const orfs: Orf[] = [];

  const scan = (s: string, strand: "+" | "-") => {
    for (let frame = 0; frame < 3; frame++) {
      let i = frame;
      while (i + 3 <= s.length) {
        if (s.charCodeAt(i) === 65 && s.charCodeAt(i + 1) === 84 && s.charCodeAt(i + 2) === 71) {
          let j = i;
          let protein = "";
          while (j + 3 <= s.length) {
            const aa = aminoAcidAt(s, j);
            if (aa === "*") {
              if (protein.length >= minAminoAcids) {
                orfs.push({
                  strand,
                  frame: frame + 1,
                  start: strand === "+" ? i : s.length - (j + 3),
                  end: strand === "+" ? j + 3 : s.length - i,
                  length: protein.length,
                  protein
                });
              }
              break;
            }
            protein += aa;
            j += 3;
          }
          i = j + 3;
        } else {
          i += 3;
        }
      }
    }
  };

  scan(fwd, "+");
  scan(rev, "-");
  return orfs.sort((a, b) => b.length - a.length);
}
