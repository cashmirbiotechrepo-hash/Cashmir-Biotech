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
export type Molecule = "dna" | "rna" | "protein" | "any";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Audience = "student" | "researcher" | "lab" | "developer";
export type TaskTag =
  | "analyze"
  | "compare"
  | "design"
  | "search"
  | "digest"
  | "translate"
  | "properties";

export type Tool = {
  slug: string;
  name: string;
  blurb: string;
  engine: string;
  status: ToolStatus;
  api?: string;
  fields?: ToolField[];
  molecules: Molecule[];
  difficulty: Difficulty;
  audience: Audience[];
  tasks: TaskTag[];
  whenToUse: string;
  input: string;
  output: string;
  runtime: string;
  popular?: boolean;
  recommendedOrder?: number;
};

export type ToolCategory = {
  id: string;
  number: number;
  name: string;
  summary: string;
  shortName: string;
  accent: "gold" | "ink" | "warm" | "slate";
  beginnerFriendly?: boolean;
  tools: Tool[];
};

const SEQ_FIELD: ToolField = {
  name: "sequence",
  label: "Sequence (raw or FASTA)",
  type: "textarea",
  placeholder: ">query\nATGCGTACGTTAGCATCGATCGATCGTAGCTAGCATCGATCG"
};

type Meta = Pick<
  Tool,
  | "molecules"
  | "difficulty"
  | "audience"
  | "tasks"
  | "whenToUse"
  | "input"
  | "output"
  | "runtime"
  | "popular"
  | "recommendedOrder"
>;

function m(meta: Meta): Meta {
  return meta;
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: "sequence-analysis",
    number: 1,
    name: "Sequence Analysis",
    shortName: "Sequence",
    accent: "gold",
    beginnerFriendly: true,
    summary: "Everyday DNA, RNA and protein sequence operations — composition, translation, motifs.",
    tools: [
      {
        slug: "sequence-composition",
        name: "Composition & GC Analyzer",
        blurb:
          "Base counts, GC/AT content, GC & AT skew, and a sliding-window GC profile for origin-of-replication signals.",
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
        ],
        ...m({
          molecules: ["dna", "rna", "protein"],
          difficulty: "beginner",
          audience: ["student", "researcher", "lab"],
          tasks: ["analyze"],
          whenToUse: "First look at any sequence — GC%, composition, skew before designing primers or cloning.",
          input: "DNA / RNA / protein sequence",
          output: "Counts, GC%, skew, window profile",
          runtime: "<1 s",
          popular: true,
          recommendedOrder: 1
        })
      },
      {
        slug: "reverse-complement",
        name: "Reverse Complement & Transcription",
        blurb:
          "Complement, reverse, reverse-complement and DNA→RNA transcription with IUPAC ambiguity support.",
        engine: "String ops",
        status: "live",
        api: "/api/tools/sequence/reverse-complement",
        fields: [SEQ_FIELD],
        ...m({
          molecules: ["dna", "rna"],
          difficulty: "beginner",
          audience: ["student", "researcher", "lab"],
          tasks: ["analyze", "translate"],
          whenToUse: "Need the opposite strand, reverse, or DNA→RNA transcript for PCR / cloning.",
          input: "DNA or RNA",
          output: "Complement / reverse / RC / RNA",
          runtime: "<1 s",
          popular: true,
          recommendedOrder: 2
        })
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
        ],
        ...m({
          molecules: ["dna", "rna"],
          difficulty: "beginner",
          audience: ["student", "researcher"],
          tasks: ["translate", "analyze"],
          whenToUse: "Find possible coding ORFs or see amino-acid translations in all frames.",
          input: "Nucleotide sequence",
          output: "Six frames + ORF list",
          runtime: "<1 s",
          popular: true,
          recommendedOrder: 3
        })
      },
      {
        slug: "motif-finder",
        name: "Motif Finder (PROSITE)",
        blurb: "Consensus / regex pattern matching across a sequence.",
        engine: "Engine Q",
        status: "documented",
        ...m({
          molecules: ["dna", "protein"],
          difficulty: "intermediate",
          audience: ["researcher"],
          tasks: ["search", "analyze"],
          whenToUse: "Locate known domains or consensus patterns in sequence.",
          input: "Sequence + pattern",
          output: "Match positions",
          runtime: "1–3 s"
        })
      },
      {
        slug: "orf-map",
        name: "Codon Usage & CAI",
        blurb: "Organism-referenced codon adaptation index.",
        engine: "Engine I",
        status: "documented",
        ...m({
          molecules: ["dna"],
          difficulty: "advanced",
          audience: ["researcher", "lab"],
          tasks: ["analyze", "properties"],
          whenToUse: "Optimize heterologous expression against codon tables.",
          input: "CDS + organism table",
          output: "CAI + codon stats",
          runtime: "1–2 s"
        })
      }
    ]
  },
  {
    id: "alignment",
    number: 2,
    name: "Alignment & Search",
    shortName: "Align",
    accent: "ink",
    beginnerFriendly: true,
    summary: "Pairwise and multiple alignment, plus BLAST-family database search.",
    tools: [
      {
        slug: "pairwise-align",
        name: "Pairwise Alignment (NW / SW)",
        blurb:
          "Needleman-Wunsch (global) & Smith-Waterman (local) with affine gap penalties (Gotoh) and BLOSUM62 / identity scoring.",
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
        ],
        ...m({
          molecules: ["dna", "protein"],
          difficulty: "intermediate",
          audience: ["student", "researcher"],
          tasks: ["compare"],
          whenToUse: "Compare exactly two sequences end-to-end or locally.",
          input: "Two sequences",
          output: "Aligned pair + score",
          runtime: "1–5 s",
          popular: true
        })
      },
      {
        slug: "blast",
        name: "BLAST (N/P/X/TBLASTN)",
        blurb:
          "Seed-and-extend heuristic search — k-mer neighborhood seeding, ungapped X-drop extension, gapped Smith-Waterman refinement and genuine Karlin-Altschul E-values.",
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
        ],
        ...m({
          molecules: ["dna", "rna", "protein"],
          difficulty: "intermediate",
          audience: ["researcher", "lab", "student"],
          tasks: ["search", "compare"],
          whenToUse: "Find similar sequences in a FASTA database with E-values.",
          input: "Query + FASTA subjects",
          output: "Hits, identities, E-values",
          runtime: "2–10 s",
          popular: true,
          recommendedOrder: 4
        })
      },
      {
        slug: "msa",
        name: "Multiple Alignment (Clustal/MUSCLE)",
        blurb: "Progressive alignment with guide tree + iterative refinement.",
        engine: "Engine C",
        status: "documented",
        ...m({
          molecules: ["dna", "protein"],
          difficulty: "advanced",
          audience: ["researcher"],
          tasks: ["compare"],
          whenToUse: "Align three or more related sequences.",
          input: "Multi-FASTA",
          output: "MSA + guide tree",
          runtime: "5–30 s"
        })
      },
      {
        slug: "consensus",
        name: "Consensus & Conserved Regions",
        blurb: "Per-column majority vote and conservation scoring over an MSA.",
        engine: "Engine C",
        status: "documented",
        ...m({
          molecules: ["dna", "protein"],
          difficulty: "intermediate",
          audience: ["researcher"],
          tasks: ["analyze", "compare"],
          whenToUse: "Find conserved columns after MSA.",
          input: "MSA",
          output: "Consensus + conservation",
          runtime: "1–3 s"
        })
      }
    ]
  },
  {
    id: "primer-design",
    number: 3,
    name: "Primer & Cloning",
    shortName: "Primers",
    accent: "warm",
    beginnerFriendly: true,
    summary: "Thermodynamics, restriction mapping, primer and CRISPR design.",
    tools: [
      {
        slug: "melting-temp",
        name: "Melting Temperature & MW",
        blurb:
          "Nearest-neighbor Tm (SantaLucia 1998) with salt correction, plus DNA molecular weight — not the crude Wallace rule.",
        engine: "Engine I",
        status: "live",
        api: "/api/tools/sequence/melting-temp",
        fields: [
          { name: "sequence", label: "Primer / oligo", type: "textarea", placeholder: "GACCTGAAGCTTGGATCCAA" },
          { name: "primerConc", label: "Primer conc (nM)", type: "number", defaultValue: 500, min: 1, max: 100000 },
          { name: "sodium", label: "Na⁺ (mM)", type: "number", defaultValue: 50, min: 1, max: 2000 }
        ],
        ...m({
          molecules: ["dna"],
          difficulty: "beginner",
          audience: ["student", "lab", "researcher"],
          tasks: ["design", "properties"],
          whenToUse: "Calculate real oligo Tm before ordering primers.",
          input: "Oligo sequence",
          output: "Tm, ΔG, MW",
          runtime: "<1 s",
          popular: true
        })
      },
      {
        slug: "restriction",
        name: "Restriction Site Finder & Digest",
        blurb:
          "IUPAC-aware recognition-site search on both strands (20 common enzymes) with fragment simulation for linear or circular DNA.",
        engine: "Engine J",
        status: "live",
        api: "/api/tools/sequence/restriction",
        fields: [SEQ_FIELD, { name: "circular", label: "Circular (plasmid)", type: "checkbox", defaultValue: false }],
        ...m({
          molecules: ["dna"],
          difficulty: "beginner",
          audience: ["lab", "student", "researcher"],
          tasks: ["digest", "analyze"],
          whenToUse: "Map cut sites or simulate a restriction digest.",
          input: "DNA (± circular)",
          output: "Sites + fragment sizes",
          runtime: "<1 s",
          popular: true
        })
      },
      {
        slug: "primer-design",
        name: "Primer Design (Primer3-style)",
        blurb: "Candidate scoring on Tm, GC clamp, dimers and specificity.",
        engine: "Engine J",
        status: "documented",
        ...m({
          molecules: ["dna"],
          difficulty: "intermediate",
          audience: ["lab", "researcher"],
          tasks: ["design"],
          whenToUse: "Design PCR primers from a template region.",
          input: "Template + constraints",
          output: "Ranked primer pairs",
          runtime: "2–8 s"
        })
      },
      {
        slug: "crispr",
        name: "CRISPR gRNA Designer",
        blurb: "PAM scanning, on-target scoring and FM-index off-target search.",
        engine: "Engine J",
        status: "documented",
        ...m({
          molecules: ["dna"],
          difficulty: "advanced",
          audience: ["researcher", "lab"],
          tasks: ["design", "search"],
          whenToUse: "Pick guide RNAs with off-target awareness.",
          input: "Target locus",
          output: "gRNAs + scores",
          runtime: "5–20 s"
        })
      }
    ]
  },
  {
    id: "protein",
    number: 4,
    name: "Protein & Structure",
    shortName: "Protein",
    accent: "slate",
    summary: "Physicochemical properties, structural geometry and viewers.",
    tools: [
      {
        slug: "protein-properties",
        name: "Protein Properties (ProtParam)",
        blurb:
          "Molecular weight, isoelectric point (Henderson-Hasselbalch root-find), extinction coefficient, GRAVY, aromaticity, and Kyte-Doolittle hydropathy profile.",
        engine: "Engine I",
        status: "live",
        api: "/api/tools/protein/properties",
        fields: [
          {
            name: "sequence",
            label: "Protein sequence",
            type: "textarea",
            placeholder: "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQ"
          },
          { name: "window", label: "Hydropathy window", type: "number", defaultValue: 9, min: 3, max: 51 }
        ],
        ...m({
          molecules: ["protein"],
          difficulty: "beginner",
          audience: ["student", "researcher", "lab"],
          tasks: ["properties", "analyze"],
          whenToUse: "Estimate pI, MW, extinction and hydropathy before expression / purification.",
          input: "Amino-acid sequence",
          output: "pI, MW, GRAVY, profile",
          runtime: "<1 s",
          popular: true
        })
      },
      {
        slug: "structure-viewer",
        name: "3D Structure Viewer (Mol*)",
        blurb: "Embed Mol*/NGL over PDB/AlphaFold coordinates.",
        engine: "Engine K",
        status: "documented",
        ...m({
          molecules: ["protein"],
          difficulty: "intermediate",
          audience: ["researcher", "student"],
          tasks: ["analyze"],
          whenToUse: "Inspect a PDB / AlphaFold structure in-browser.",
          input: "PDB / mmCIF",
          output: "Interactive 3D view",
          runtime: "interactive"
        })
      },
      {
        slug: "rmsd",
        name: "RMSD (Kabsch)",
        blurb: "Optimal superposition before distance measurement.",
        engine: "Engine K",
        status: "documented",
        ...m({
          molecules: ["protein"],
          difficulty: "advanced",
          audience: ["researcher"],
          tasks: ["compare"],
          whenToUse: "Quantify structural deviation after superposition.",
          input: "Two coordinate sets",
          output: "RMSD",
          runtime: "1–3 s"
        })
      },
      {
        slug: "ramachandran",
        name: "Ramachandran Plot",
        blurb: "Backbone phi/psi dihedral geometry from coordinates.",
        engine: "Engine K",
        status: "documented",
        ...m({
          molecules: ["protein"],
          difficulty: "intermediate",
          audience: ["researcher", "student"],
          tasks: ["analyze", "properties"],
          whenToUse: "Validate backbone angles of a model.",
          input: "Structure coords",
          output: "φ/ψ scatter",
          runtime: "1–2 s"
        })
      }
    ]
  },
  {
    id: "phylogenetics",
    number: 5,
    name: "Phylogenetics",
    shortName: "Trees",
    accent: "ink",
    summary: "Distance- and character-based tree building with support metrics.",
    tools: [
      {
        slug: "nj",
        name: "Neighbor-Joining",
        blurb: "Q-matrix joining without a molecular-clock assumption.",
        engine: "Engine D",
        status: "documented",
        ...m({
          molecules: ["dna", "protein"],
          difficulty: "advanced",
          audience: ["researcher"],
          tasks: ["compare"],
          whenToUse: "Build a distance tree from a matrix.",
          input: "Distance matrix",
          output: "Newick tree",
          runtime: "2–10 s"
        })
      },
      {
        slug: "upgma",
        name: "UPGMA",
        blurb: "Fast agglomerative clustering for guide trees.",
        engine: "Engine D",
        status: "documented",
        ...m({
          molecules: ["dna", "protein"],
          difficulty: "intermediate",
          audience: ["researcher", "student"],
          tasks: ["compare"],
          whenToUse: "Quick ultrametric tree / MSA guide tree.",
          input: "Distance matrix",
          output: "Newick tree",
          runtime: "1–5 s"
        })
      },
      {
        slug: "bootstrap",
        name: "Bootstrap Support",
        blurb: "Column resampling to measure clade confidence.",
        engine: "Engine D",
        status: "documented",
        ...m({
          molecules: ["dna", "protein"],
          difficulty: "advanced",
          audience: ["researcher"],
          tasks: ["analyze"],
          whenToUse: "Assess clade support on a tree.",
          input: "MSA + tree method",
          output: "Support values",
          runtime: "10–60 s"
        })
      },
      {
        slug: "tree-viewer",
        name: "Tree Viewer / Newick",
        blurb: "Recursive Newick parsing and cladogram/circular layout.",
        engine: "Engine D",
        status: "documented",
        ...m({
          molecules: ["any"],
          difficulty: "beginner",
          audience: ["student", "researcher"],
          tasks: ["analyze"],
          whenToUse: "Visualize an existing Newick tree.",
          input: "Newick string",
          output: "Cladogram / circular",
          runtime: "interactive"
        })
      }
    ]
  },
  {
    id: "expression",
    number: 6,
    name: "Expression & Stats",
    shortName: "Expression",
    accent: "warm",
    summary: "Count normalization and differential expression done with the correct statistics.",
    tools: [
      {
        slug: "normalize",
        name: "TPM / FPKM / Size Factors",
        blurb: "Length- and depth-aware normalization (median-of-ratios, TMM).",
        engine: "Engine G",
        status: "documented",
        ...m({
          molecules: ["rna"],
          difficulty: "intermediate",
          audience: ["researcher"],
          tasks: ["analyze"],
          whenToUse: "Normalize RNA-seq counts for comparison.",
          input: "Count matrix",
          output: "Normalized matrix",
          runtime: "2–15 s"
        })
      },
      {
        slug: "differential",
        name: "Differential Expression",
        blurb: "Negative-binomial GLM with Benjamini-Hochberg FDR.",
        engine: "Engine G",
        status: "documented",
        ...m({
          molecules: ["rna"],
          difficulty: "advanced",
          audience: ["researcher"],
          tasks: ["compare", "analyze"],
          whenToUse: "Find differentially expressed genes between conditions.",
          input: "Counts + design",
          output: "DE table + FDR",
          runtime: "10–60 s"
        })
      },
      {
        slug: "pca",
        name: "PCA Plot",
        blurb: "Variance-stabilized SVD projection of samples.",
        engine: "Engine G",
        status: "documented",
        ...m({
          molecules: ["rna", "any"],
          difficulty: "intermediate",
          audience: ["researcher", "student"],
          tasks: ["analyze"],
          whenToUse: "See sample clustering / batch effects.",
          input: "Expression matrix",
          output: "PC scatter",
          runtime: "2–10 s"
        })
      },
      {
        slug: "enrichment",
        name: "GO / Pathway Enrichment",
        blurb: "Hypergeometric test with multiple-testing correction.",
        engine: "Engine L",
        status: "documented",
        ...m({
          molecules: ["any"],
          difficulty: "intermediate",
          audience: ["researcher"],
          tasks: ["search", "analyze"],
          whenToUse: "Interpret a gene list biologically.",
          input: "Gene list + ontology",
          output: "Enriched terms",
          runtime: "3–20 s"
        })
      }
    ]
  },
  {
    id: "genomics",
    number: 7,
    name: "Genomics & Reads",
    shortName: "Genome",
    accent: "slate",
    summary: "Read alignment, assembly, variant calling and interval algebra.",
    tools: [
      {
        slug: "read-align",
        name: "Read Alignment (BWA/Bowtie2)",
        blurb: "FM-index seeding + Smith-Waterman extension.",
        engine: "Engine F",
        status: "documented",
        ...m({
          molecules: ["dna", "rna"],
          difficulty: "advanced",
          audience: ["researcher", "developer"],
          tasks: ["search", "compare"],
          whenToUse: "Map short reads to a reference.",
          input: "FASTQ + reference",
          output: "SAM / BAM",
          runtime: "minutes+"
        })
      },
      {
        slug: "assembly",
        name: "De Novo Assembly",
        blurb: "De Bruijn graph + Eulerian path (Hierholzer).",
        engine: "Engine F",
        status: "documented",
        ...m({
          molecules: ["dna"],
          difficulty: "advanced",
          audience: ["researcher"],
          tasks: ["analyze"],
          whenToUse: "Assemble contigs without a reference.",
          input: "Reads",
          output: "Contigs",
          runtime: "minutes+"
        })
      },
      {
        slug: "variants",
        name: "Variant Calling",
        blurb: "Bayesian genotype likelihoods per position.",
        engine: "Engine F",
        status: "documented",
        ...m({
          molecules: ["dna"],
          difficulty: "advanced",
          audience: ["researcher", "lab"],
          tasks: ["analyze", "search"],
          whenToUse: "Call SNVs / indels from alignments.",
          input: "BAM + reference",
          output: "VCF",
          runtime: "minutes+"
        })
      },
      {
        slug: "intervals",
        name: "Interval Operations (BEDTools)",
        blurb: "Interval-tree intersect / merge / coverage.",
        engine: "Engine H",
        status: "documented",
        ...m({
          molecules: ["any"],
          difficulty: "intermediate",
          audience: ["researcher", "developer"],
          tasks: ["analyze"],
          whenToUse: "Intersect or merge genomic intervals.",
          input: "BED / GFF",
          output: "Interval results",
          runtime: "1–10 s"
        })
      }
    ]
  },
  {
    id: "sets",
    number: 8,
    name: "Lists & Conversion",
    shortName: "Lists",
    accent: "gold",
    summary: "Gene-list set algebra, ID conversion and format parsing.",
    tools: [
      {
        slug: "set-ops",
        name: "Set Operations & Venn",
        blurb: "Union/intersection/difference over normalized gene lists.",
        engine: "Engine P",
        status: "documented",
        ...m({
          molecules: ["any"],
          difficulty: "beginner",
          audience: ["student", "researcher"],
          tasks: ["compare"],
          whenToUse: "Compare gene / ID lists across experiments.",
          input: "Two+ ID lists",
          output: "Set results / Venn",
          runtime: "<1 s"
        })
      },
      {
        slug: "id-convert",
        name: "Gene ID Converter",
        blurb: "Cross-reference symbol ↔ Entrez ↔ Ensembl ↔ UniProt.",
        engine: "Engine P",
        status: "documented",
        ...m({
          molecules: ["any"],
          difficulty: "beginner",
          audience: ["researcher", "student", "lab"],
          tasks: ["analyze"],
          whenToUse: "Map gene identifiers across databases.",
          input: "ID list + namespaces",
          output: "Mapped table",
          runtime: "1–5 s"
        })
      },
      {
        slug: "format-convert",
        name: "Format Converter",
        blurb: "Strict parsers/writers (FASTA, GFF↔BED, VCF, GenBank).",
        engine: "Engine Q",
        status: "documented",
        ...m({
          molecules: ["any"],
          difficulty: "beginner",
          audience: ["developer", "researcher"],
          tasks: ["analyze"],
          whenToUse: "Convert between common bioinformatics formats.",
          input: "File / text",
          output: "Converted format",
          runtime: "1–5 s"
        })
      }
    ]
  }
];

export const LIVE_TOOLS = TOOL_CATEGORIES.flatMap((c) => c.tools).filter((t) => t.status === "live");

export const RECOMMENDED_PATH = LIVE_TOOLS.filter((t) => typeof t.recommendedOrder === "number").sort(
  (a, b) => (a.recommendedOrder ?? 99) - (b.recommendedOrder ?? 99)
);

export const POPULAR_TOOLS = LIVE_TOOLS.filter((t) => t.popular);

export const TASK_ACTIONS: { id: TaskTag; label: string; hint: string }[] = [
  { id: "analyze", label: "Analyze a sequence", hint: "Composition, ORFs, properties" },
  { id: "compare", label: "Compare sequences", hint: "Alignment & similarity" },
  { id: "design", label: "Design primers", hint: "Tm, cloning, guides" },
  { id: "search", label: "Search a database", hint: "BLAST-family engines" },
  { id: "digest", label: "Find cut sites", hint: "Restriction digests" },
  { id: "translate", label: "Translate DNA", hint: "Frames & ORFs" },
  { id: "properties", label: "Protein properties", hint: "pI, MW, GRAVY" }
];

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

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced"
};

export const MOLECULE_LABEL: Record<Molecule, string> = {
  dna: "DNA",
  rna: "RNA",
  protein: "Protein",
  any: "Any"
};
