/**
 * Bioinformatics suite catalog. Live tools are fully wired to /api/tools/*;
 * documented tools describe the engine they will wrap (per the technical spec).
 */

export type FieldType = "textarea" | "text" | "number" | "select" | "checkbox";

export type ToolField = {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
};

export type ToolStatus = "live" | "documented";

export type Tool = {
  slug: string;
  name: string;
  blurb: string;
  engine: string;
  status: ToolStatus;
  api?: string;
  fields?: ToolField[];
};

export type ToolCategory = {
  id: string;
  number: number;
  name: string;
  summary: string;
  tools: Tool[];
};

const SEQ_FIELD: ToolField = {
  name: "sequence",
  label: "Sequence (raw or FASTA)",
  type: "textarea",
  placeholder: ">query\nATGCGTACGTTAGCATCGATCGATCGTAGCTAGCATCGATCG"
};

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: "sequence-analysis",
    number: 1,
    name: "Sequence Analysis",
    summary: "Everyday DNA, RNA and protein sequence operations — composition, translation, motifs.",
    tools: [
      {
        slug: "sequence-composition",
        name: "Composition & GC Analyzer",
        blurb: "Base counts, GC/AT content, GC & AT skew, and a sliding-window GC profile for origin-of-replication signals.",
        engine: "Engine I",
        status: "live",
        api: "/api/tools/sequence/composition",
        fields: [
          SEQ_FIELD,
          {
            name: "type",
            label: "Molecule",
            type: "select",
            defaultValue: "dna",
            options: [
              { value: "dna", label: "DNA" },
              { value: "rna", label: "RNA" },
              { value: "protein", label: "Protein" }
            ]
          },
          { name: "window", label: "Skew window (bp)", type: "number", defaultValue: 100, min: 10, max: 5000 }
        ]
      },
      {
        slug: "reverse-complement",
        name: "Reverse Complement & Transcription",
        blurb: "Complement, reverse, reverse-complement and DNA→RNA transcription with IUPAC ambiguity support.",
        engine: "String ops",
        status: "live",
        api: "/api/tools/sequence/reverse-complement",
        fields: [SEQ_FIELD]
      },
      {
        slug: "translate",
        name: "Six-Frame Translation & ORF Finder",
        blurb: "Translate all six reading frames and enumerate open reading frames above a length threshold.",
        engine: "Codon table",
        status: "live",
        api: "/api/tools/sequence/translate",
        fields: [
          SEQ_FIELD,
          { name: "minOrf", label: "Min ORF (aa)", type: "number", defaultValue: 30, min: 1, max: 5000 }
        ]
      },
      { slug: "motif-finder", name: "Motif Finder (PROSITE)", blurb: "Consensus / regex pattern matching across a sequence.", engine: "Engine Q", status: "documented" },
      { slug: "orf-map", name: "Codon Usage & CAI", blurb: "Organism-referenced codon adaptation index.", engine: "Engine I", status: "documented" }
    ]
  },
  {
    id: "alignment",
    number: 2,
    name: "Alignment & Search",
    summary: "Pairwise and multiple alignment, plus BLAST-family database search.",
    tools: [
      {
        slug: "pairwise-align",
        name: "Pairwise Alignment (NW / SW)",
        blurb: "Needleman-Wunsch (global) & Smith-Waterman (local) with affine gap penalties (Gotoh) and BLOSUM62 / identity scoring.",
        engine: "Engine A",
        status: "live",
        api: "/api/tools/align/pairwise",
        fields: [
          { name: "seq1", label: "Sequence 1", type: "textarea", placeholder: "MKTAYIAKQR" },
          { name: "seq2", label: "Sequence 2", type: "textarea", placeholder: "MKTAYIAKNR" },
          {
            name: "mode",
            label: "Mode",
            type: "select",
            defaultValue: "global",
            options: [
              { value: "global", label: "Global (Needleman-Wunsch)" },
              { value: "local", label: "Local (Smith-Waterman)" }
            ]
          },
          {
            name: "matrix",
            label: "Scoring",
            type: "select",
            defaultValue: "identity",
            options: [
              { value: "identity", label: "DNA identity (+1/−1)" },
              { value: "blosum62", label: "Protein BLOSUM62" }
            ]
          },
          { name: "gapOpen", label: "Gap open", type: "number", defaultValue: -10, step: 0.5 },
          { name: "gapExtend", label: "Gap extend", type: "number", defaultValue: -1, step: 0.5 }
        ]
      },
      {
        slug: "blast",
        name: "BLAST (N/P/X/TBLASTN)",
        blurb: "Seed-and-extend heuristic search — k-mer neighborhood seeding, ungapped X-drop extension, gapped Smith-Waterman refinement and genuine Karlin-Altschul E-values.",
        engine: "Engine B",
        status: "live",
        api: "/api/tools/search/blast",
        fields: [
          {
            name: "query",
            label: "Query (raw or FASTA)",
            type: "textarea",
            placeholder: ">query\nATGGCACTGTGGATGCGCCTCCTGCCCCTGCTGGCGCTGCTGGCCCTCTGG"
          },
          {
            name: "database",
            label: "Database — one or more FASTA subjects",
            type: "textarea",
            placeholder: ">subject_1\nATGGCACTGTGGATGCGC...\n>subject_2\nATGGCTCTGTGGATGCGT..."
          },
          {
            name: "program",
            label: "Program",
            type: "select",
            defaultValue: "blastn",
            options: [
              { value: "blastn", label: "blastn — nucleotide vs nucleotide" },
              { value: "blastp", label: "blastp — protein vs protein" },
              { value: "blastx", label: "blastx — translated query vs protein" },
              { value: "tblastn", label: "tblastn — protein vs translated db" },
              { value: "tblastx", label: "tblastx — translated vs translated" }
            ]
          },
          { name: "evalue", label: "E-value cutoff", type: "number", defaultValue: 10, step: 0.1, min: 0 },
          { name: "maxHits", label: "Max hits", type: "number", defaultValue: 25, min: 1, max: 200 }
        ]
      },
      { slug: "msa", name: "Multiple Alignment (Clustal/MUSCLE)", blurb: "Progressive alignment with guide tree + iterative refinement.", engine: "Engine C", status: "documented" },
      { slug: "consensus", name: "Consensus & Conserved Regions", blurb: "Per-column majority vote and conservation scoring over an MSA.", engine: "Engine C", status: "documented" }
    ]
  },
  {
    id: "primer-design",
    number: 3,
    name: "Primer & Cloning",
    summary: "Thermodynamics, restriction mapping, primer and CRISPR design.",
    tools: [
      {
        slug: "melting-temp",
        name: "Melting Temperature & MW",
        blurb: "Nearest-neighbor Tm (SantaLucia 1998) with salt correction, plus DNA molecular weight — not the crude Wallace rule.",
        engine: "Engine I",
        status: "live",
        api: "/api/tools/sequence/melting-temp",
        fields: [
          { name: "sequence", label: "Primer / oligo", type: "textarea", placeholder: "GACCTGAAGCTTGGATCCAA" },
          { name: "primerConc", label: "Primer conc (nM)", type: "number", defaultValue: 500, min: 1, max: 100000 },
          { name: "sodium", label: "Na⁺ (mM)", type: "number", defaultValue: 50, min: 1, max: 2000 }
        ]
      },
      {
        slug: "restriction",
        name: "Restriction Site Finder & Digest",
        blurb: "IUPAC-aware recognition-site search on both strands (20 common enzymes) with fragment simulation for linear or circular DNA.",
        engine: "Engine J",
        status: "live",
        api: "/api/tools/sequence/restriction",
        fields: [
          SEQ_FIELD,
          { name: "circular", label: "Circular (plasmid)", type: "checkbox", defaultValue: false }
        ]
      },
      { slug: "primer-design", name: "Primer Design (Primer3-style)", blurb: "Candidate scoring on Tm, GC clamp, dimers and specificity.", engine: "Engine J", status: "documented" },
      { slug: "crispr", name: "CRISPR gRNA Designer", blurb: "PAM scanning, on-target scoring and FM-index off-target search.", engine: "Engine J", status: "documented" }
    ]
  },
  {
    id: "protein",
    number: 4,
    name: "Protein & Structure",
    summary: "Physicochemical properties, structural geometry and viewers.",
    tools: [
      {
        slug: "protein-properties",
        name: "Protein Properties (ProtParam)",
        blurb: "Molecular weight, isoelectric point (Henderson-Hasselbalch root-find), extinction coefficient, GRAVY, aromaticity, and Kyte-Doolittle hydropathy profile.",
        engine: "Engine I",
        status: "live",
        api: "/api/tools/protein/properties",
        fields: [
          { name: "sequence", label: "Protein sequence", type: "textarea", placeholder: "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQ" },
          { name: "window", label: "Hydropathy window", type: "number", defaultValue: 9, min: 3, max: 51 }
        ]
      },
      { slug: "structure-viewer", name: "3D Structure Viewer (Mol*)", blurb: "Embed Mol*/NGL over PDB/AlphaFold coordinates.", engine: "Engine K", status: "documented" },
      { slug: "rmsd", name: "RMSD (Kabsch)", blurb: "Optimal superposition before distance measurement.", engine: "Engine K", status: "documented" },
      { slug: "ramachandran", name: "Ramachandran Plot", blurb: "Backbone phi/psi dihedral geometry from coordinates.", engine: "Engine K", status: "documented" }
    ]
  },
  {
    id: "phylogenetics",
    number: 5,
    name: "Phylogenetics",
    summary: "Distance- and character-based tree building with support metrics.",
    tools: [
      { slug: "nj", name: "Neighbor-Joining", blurb: "Q-matrix joining without a molecular-clock assumption.", engine: "Engine D", status: "documented" },
      { slug: "upgma", name: "UPGMA", blurb: "Fast agglomerative clustering for guide trees.", engine: "Engine D", status: "documented" },
      { slug: "bootstrap", name: "Bootstrap Support", blurb: "Column resampling to measure clade confidence.", engine: "Engine D", status: "documented" },
      { slug: "tree-viewer", name: "Tree Viewer / Newick", blurb: "Recursive Newick parsing and cladogram/circular layout.", engine: "Engine D", status: "documented" }
    ]
  },
  {
    id: "expression",
    number: 6,
    name: "Expression & Stats",
    summary: "Count normalization and differential expression done with the correct statistics.",
    tools: [
      { slug: "normalize", name: "TPM / FPKM / Size Factors", blurb: "Length- and depth-aware normalization (median-of-ratios, TMM).", engine: "Engine G", status: "documented" },
      { slug: "differential", name: "Differential Expression", blurb: "Negative-binomial GLM with Benjamini-Hochberg FDR.", engine: "Engine G", status: "documented" },
      { slug: "pca", name: "PCA Plot", blurb: "Variance-stabilized SVD projection of samples.", engine: "Engine G", status: "documented" },
      { slug: "enrichment", name: "GO / Pathway Enrichment", blurb: "Hypergeometric test with multiple-testing correction.", engine: "Engine L", status: "documented" }
    ]
  },
  {
    id: "genomics",
    number: 7,
    name: "Genomics & Reads",
    summary: "Read alignment, assembly, variant calling and interval algebra.",
    tools: [
      { slug: "read-align", name: "Read Alignment (BWA/Bowtie2)", blurb: "FM-index seeding + Smith-Waterman extension.", engine: "Engine F", status: "documented" },
      { slug: "assembly", name: "De Novo Assembly", blurb: "De Bruijn graph + Eulerian path (Hierholzer).", engine: "Engine F", status: "documented" },
      { slug: "variants", name: "Variant Calling", blurb: "Bayesian genotype likelihoods per position.", engine: "Engine F", status: "documented" },
      { slug: "intervals", name: "Interval Operations (BEDTools)", blurb: "Interval-tree intersect / merge / coverage.", engine: "Engine H", status: "documented" }
    ]
  },
  {
    id: "sets",
    number: 8,
    name: "Lists & Conversion",
    summary: "Gene-list set algebra, ID conversion and format parsing.",
    tools: [
      { slug: "set-ops", name: "Set Operations & Venn", blurb: "Union/intersection/difference over normalized gene lists.", engine: "Engine P", status: "documented" },
      { slug: "id-convert", name: "Gene ID Converter", blurb: "Cross-reference symbol ↔ Entrez ↔ Ensembl ↔ UniProt.", engine: "Engine P", status: "documented" },
      { slug: "format-convert", name: "Format Converter", blurb: "Strict parsers/writers (FASTA, GFF↔BED, VCF, GenBank).", engine: "Engine Q", status: "documented" }
    ]
  }
];

export const LIVE_TOOLS = TOOL_CATEGORIES.flatMap((c) => c.tools).filter((t) => t.status === "live");

export function findTool(slug: string): { tool: Tool; category: ToolCategory } | null {
  for (const category of TOOL_CATEGORIES) {
    const tool = category.tools.find((t) => t.slug === slug);
    if (tool) return { tool, category };
  }
  return null;
}

export const TOTAL_TOOL_COUNT = 300;
export const LIVE_TOOL_COUNT = LIVE_TOOLS.length;
export const ENGINE_COUNT = 18;
