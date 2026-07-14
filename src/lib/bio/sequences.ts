/** Sequence primitives: validation, cleaning, and basic transforms. */

export type MoleculeType = "dna" | "rna" | "protein";

const DNA = new Set("ACGT".split(""));
const IUPAC_DNA = new Set("ACGTRYSWKMBDHVN".split(""));
const RNA = new Set("ACGU".split(""));
const PROTEIN = new Set("ACDEFGHIKLMNPQRSTVWY".split(""));

const COMPLEMENT: Record<string, string> = {
  A: "T", T: "A", G: "C", C: "G", U: "A",
  R: "Y", Y: "R", S: "S", W: "W", K: "M", M: "K",
  B: "V", V: "B", D: "H", H: "D", N: "N"
};

/** Strip whitespace, numbers, and FASTA headers; uppercase. */
export function cleanSequence(input: string): string {
  return input
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(">"))
    .join("")
    .replace(/\s/g, "")
    .replace(/[0-9]/g, "")
    .toUpperCase();
}

export type FastaRecord = { id: string; description: string; sequence: string };

/** Minimal but correct FASTA parser — concatenates wrapped sequence lines. */
export function parseFasta(input: string): FastaRecord[] {
  const records: FastaRecord[] = [];
  let current: FastaRecord | null = null;
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.startsWith(">")) {
      if (current) records.push(current);
      const header = line.slice(1).trim();
      const [id, ...rest] = header.split(/\s+/);
      current = { id: id ?? "", description: rest.join(" "), sequence: "" };
    } else if (current) {
      current.sequence += line.replace(/\s/g, "").toUpperCase();
    }
  }
  if (current) records.push(current);
  return records;
}

export function validate(seq: string, type: MoleculeType): { valid: boolean; invalidChars: string[] } {
  const set = type === "dna" ? IUPAC_DNA : type === "rna" ? RNA : PROTEIN;
  const invalid = new Set<string>();
  for (const c of seq) if (!set.has(c)) invalid.add(c);
  return { valid: invalid.size === 0, invalidChars: [...invalid] };
}

export function detectType(seq: string): MoleculeType {
  const s = cleanSequence(seq);
  if (!s) return "dna";
  const acgt = [...s].filter((c) => DNA.has(c)).length;
  const acgu = [...s].filter((c) => RNA.has(c)).length;
  if (acgu / s.length > 0.9 && s.includes("U")) return "rna";
  if (acgt / s.length > 0.9) return "dna";
  return "protein";
}

export function reverseComplement(seq: string): string {
  return [...cleanSequence(seq)]
    .reverse()
    .map((c) => COMPLEMENT[c] ?? "N")
    .join("");
}

export function complement(seq: string): string {
  return [...cleanSequence(seq)].map((c) => COMPLEMENT[c] ?? "N").join("");
}

export function transcribe(seq: string): string {
  return cleanSequence(seq).replace(/T/g, "U");
}

export function reverseTranscribe(seq: string): string {
  return cleanSequence(seq).replace(/U/g, "T");
}

export type BaseComposition = {
  length: number;
  counts: Record<string, number>;
  gcContent: number;
  atContent: number;
  gcSkew: number;
  atSkew: number;
};

/** Global base composition and GC/AT skew. */
export function baseComposition(seq: string): BaseComposition {
  const s = cleanSequence(seq);
  const counts: Record<string, number> = {};
  for (const c of s) counts[c] = (counts[c] ?? 0) + 1;
  const g = counts.G ?? 0;
  const c = counts.C ?? 0;
  const a = counts.A ?? 0;
  const t = (counts.T ?? 0) + (counts.U ?? 0);
  const length = s.length || 1;
  return {
    length: s.length,
    counts,
    gcContent: (g + c) / length,
    atContent: (a + t) / length,
    gcSkew: g + c === 0 ? 0 : (g - c) / (g + c),
    atSkew: a + t === 0 ? 0 : (a - t) / (a + t)
  };
}

/** Sliding-window GC content — used for origin-of-replication style analysis. */
export function windowedGc(seq: string, window = 100, step = 50) {
  const s = cleanSequence(seq);
  const points: { position: number; gc: number; gcSkew: number }[] = [];
  for (let i = 0; i + window <= s.length; i += step) {
    const sub = s.slice(i, i + window);
    const comp = baseComposition(sub);
    points.push({ position: i + Math.floor(window / 2), gc: comp.gcContent, gcSkew: comp.gcSkew });
  }
  return points;
}
