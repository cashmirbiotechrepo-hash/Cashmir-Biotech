/**
 * Engine J (subset) — Restriction site finding & digest simulation.
 * IUPAC-aware, both strands, handles circular sequences.
 */

import { cleanSequence, reverseComplement } from "@/lib/bio/sequences";

export type Enzyme = { name: string; site: string; cut: number };

// Common enzymes: `site` = recognition sequence, `cut` = 0-based offset on top strand.
export const ENZYMES: Enzyme[] = [
  { name: "EcoRI", site: "GAATTC", cut: 1 },
  { name: "BamHI", site: "GGATCC", cut: 1 },
  { name: "HindIII", site: "AAGCTT", cut: 1 },
  { name: "NotI", site: "GCGGCCGC", cut: 2 },
  { name: "XhoI", site: "CTCGAG", cut: 1 },
  { name: "PstI", site: "CTGCAG", cut: 5 },
  { name: "SmaI", site: "CCCGGG", cut: 3 },
  { name: "SalI", site: "GTCGAC", cut: 1 },
  { name: "KpnI", site: "GGTACC", cut: 5 },
  { name: "SacI", site: "GAGCTC", cut: 5 },
  { name: "SpeI", site: "ACTAGT", cut: 1 },
  { name: "XbaI", site: "TCTAGA", cut: 1 },
  { name: "NcoI", site: "CCATGG", cut: 1 },
  { name: "NdeI", site: "CATATG", cut: 2 },
  { name: "EcoRV", site: "GATATC", cut: 3 },
  { name: "BsaI", site: "GGTCTC", cut: 1 },
  { name: "DpnI", site: "GATC", cut: 2 },
  { name: "HaeIII", site: "GGCC", cut: 2 },
  { name: "AluI", site: "AGCT", cut: 2 },
  { name: "TaqI", site: "TCGA", cut: 1 }
];

const IUPAC: Record<string, string> = {
  A: "A", C: "C", G: "G", T: "T",
  R: "AG", Y: "CT", S: "GC", W: "AT", K: "GT", M: "AC",
  B: "CGT", D: "AGT", H: "ACT", V: "ACG", N: "ACGT"
};

function siteToRegex(site: string): RegExp {
  const body = site
    .toUpperCase()
    .split("")
    .map((c) => {
      const set = IUPAC[c] ?? c;
      return set.length > 1 ? `[${set}]` : set;
    })
    .join("");
  return new RegExp(body, "g");
}

export type SiteHit = { enzyme: string; position: number; strand: "+" | "-"; cutPosition: number; site: string };

export function findSites(
  seq: string,
  enzymeNames?: string[],
  circular = false
): SiteHit[] {
  const s = cleanSequence(seq).replace(/U/g, "T");
  const list = enzymeNames && enzymeNames.length
    ? ENZYMES.filter((e) => enzymeNames.includes(e.name))
    : ENZYMES;

  const hits: SiteHit[] = [];
  const searchSpace = circular ? s + s.slice(0, 20) : s;

  for (const enz of list) {
    const isPalindrome = enz.site === reverseComplement(enz.site);
    const patterns: { re: RegExp; strand: "+" | "-" }[] = [
      { re: siteToRegex(enz.site), strand: "+" }
    ];
    if (!isPalindrome) patterns.push({ re: siteToRegex(reverseComplement(enz.site)), strand: "-" });

    for (const { re, strand } of patterns) {
      let match: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((match = re.exec(searchSpace))) {
        const pos = match.index;
        if (pos >= s.length) break;
        hits.push({
          enzyme: enz.name,
          position: pos + 1,
          strand,
          cutPosition: ((pos + enz.cut) % s.length) + 1,
          site: enz.site
        });
        re.lastIndex = pos + 1;
      }
    }
  }
  return hits.sort((a, b) => a.position - b.position);
}

export type Fragment = { start: number; end: number; length: number };

/** Simulate a digest — fragments between consecutive top-strand cuts. */
export function digest(seq: string, enzymeNames: string[], circular = false) {
  const s = cleanSequence(seq).replace(/U/g, "T");
  const cuts = [...new Set(findSites(s, enzymeNames, circular).map((h) => h.cutPosition - 1))].sort(
    (a, b) => a - b
  );

  const fragments: Fragment[] = [];
  if (cuts.length === 0) {
    fragments.push({ start: 1, end: s.length, length: s.length });
    return { cuts: [], fragments };
  }

  if (circular) {
    for (let i = 0; i < cuts.length; i++) {
      const start = cuts[i];
      const end = cuts[(i + 1) % cuts.length];
      const length = end > start ? end - start : s.length - start + end;
      fragments.push({ start: start + 1, end: end + 1, length });
    }
  } else {
    let prev = 0;
    for (const cut of cuts) {
      fragments.push({ start: prev + 1, end: cut, length: cut - prev });
      prev = cut;
    }
    fragments.push({ start: prev + 1, end: s.length, length: s.length - prev });
  }
  return { cuts: cuts.map((c) => c + 1), fragments: fragments.sort((a, b) => b.length - a.length) };
}
