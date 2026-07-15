/** Unlisted computational biology short courses — /certificate only. */

export type CertificateCourse = {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  domain: "computing" | "biology" | "interop";
  credits: 1;
  /** GST-inclusive fee in paise (₹1,000.00) */
  feeInclusiveCents: number;
  hours: number;
  outcomes: string[];
};

export const CERTIFICATE_FEE_INCLUSIVE_CENTS = 100_000; // ₹1,000 incl. GST
export const CERTIFICATE_GST_RATE = 0.18;
export const CERTIFICATE_HSN = "999293"; // Education support / course services

export const CERTIFICATE_COURSES: CertificateCourse[] = [
  {
    id: "cbio-101",
    code: "CBIO-101",
    title: "Computational Genomics Foundations",
    subtitle: "Genome assembly concepts, variant calling vocabulary, and reproducible pipelines.",
    domain: "interop",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 14,
    outcomes: ["NGS glossary fluency", "Reference-aware QC basics", "Reproducible run books"]
  },
  {
    id: "cbio-102",
    code: "CBIO-102",
    title: "Python for Biological Data Analysis",
    subtitle: "Pandas, Biopython, and notebook hygiene for bench-to-desk workflows.",
    domain: "computing",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 16,
    outcomes: ["Tabular cleaning", "Sequence I/O", "Plot-ready summaries"]
  },
  {
    id: "cbio-103",
    code: "CBIO-103",
    title: "Bioinformatics Pipeline Engineering",
    subtitle: "Modular workflows, containers, and versioned compute for lab production.",
    domain: "computing",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 15,
    outcomes: ["Snakemake/Nextflow patterns", "Container handoff", "Artifact provenance"]
  },
  {
    id: "cbio-104",
    code: "CBIO-104",
    title: "Machine Learning in Computational Biology",
    subtitle: "Feature design, model critique, and responsible evaluation on omics tables.",
    domain: "interop",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 16,
    outcomes: ["Train/test discipline", "Interpretation pitfalls", "Reporting standards"]
  },
  {
    id: "cbio-105",
    code: "CBIO-105",
    title: "Sequence Databases & BLAST Workflows",
    subtitle: "NCBI/EBI search craft, E-value literacy, and annotation handoff.",
    domain: "biology",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 12,
    outcomes: ["Query design", "Hit triage", "Annotation notes"]
  },
  {
    id: "cbio-106",
    code: "CBIO-106",
    title: "Structural Bioinformatics & Protein Modeling",
    subtitle: "Structure browsers, homology models, and pocket-aware visual analysis.",
    domain: "biology",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 14,
    outcomes: ["PDB literacy", "Model confidence reading", "Structure presentation"]
  },
  {
    id: "cbio-107",
    code: "CBIO-107",
    title: "Systems Biology Network Analysis",
    subtitle: "Pathway graphs, centrality intuition, and multi-omics integration sketches.",
    domain: "interop",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 14,
    outcomes: ["Network construction", "Hub interpretation", "Hypothesis framing"]
  },
  {
    id: "cbio-108",
    code: "CBIO-108",
    title: "Metagenomics & Microbiome Informatics",
    subtitle: "Amplicon vs shotgun decisions, diversity metrics, and contamination awareness.",
    domain: "biology",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 15,
    outcomes: ["Marker gene workflows", "Diversity reporting", "QC red flags"]
  },
  {
    id: "cbio-109",
    code: "CBIO-109",
    title: "Digital Pathology Image Computing",
    subtitle: "Whole-slide basics, tile sampling, and compute-aware annotation practice.",
    domain: "computing",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 14,
    outcomes: ["WSI orientation", "Sampling bias", "Label protocols"]
  },
  {
    id: "cbio-110",
    code: "CBIO-110",
    title: "Scientific Computing Ethics & Research Data Integrity",
    subtitle: "FAIR habits, audit trails, authorship clarity, and secure data handling.",
    domain: "interop",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 10,
    outcomes: ["FAIR checklist", "Lab notebook digital norms", "Disclosure language"]
  }
];

export const CERTIFICATE_ISSUER = {
  legalName: "Sher-e-Kashmir University of Agricultural Sciences & Technology of Kashmir",
  shortName: "SKUAST-K",
  unit: "Continuing Education Cell · Computational Biology Programme",
  campus: "Shalimar Campus",
  city: "Srinagar",
  state: "Jammu and Kashmir",
  pincode: "190025",
  country: "India",
  email: "continuinged@skuastkashmir.ac.in",
  phone: "+91 194 246 2159",
  website: "https://www.skuastkashmir.ac.in",
  /** Faculty finance desk reference — not a fabricated GSTIN */
  gstNote: "Tax collected under university finance norms for short-course fees",
  sacHsn: CERTIFICATE_HSN,
  programmeCode: "SKUAST-K / CEC-CB / 2026"
} as const;

export function getCoursesByIds(ids: string[]) {
  const set = new Set(ids);
  return CERTIFICATE_COURSES.filter((c) => set.has(c.id));
}

/** Split GST-inclusive total into taxable + tax (paise), conserving exact inclusive amount. */
export function splitInclusiveGst(inclusiveCents: number, rate = CERTIFICATE_GST_RATE) {
  const taxable = Math.round(inclusiveCents / (1 + rate));
  const tax = inclusiveCents - taxable;
  const half = Math.floor(tax / 2);
  const cgst = half;
  const sgst = tax - half;
  return { taxableCents: taxable, taxCents: tax, cgstCents: cgst, sgstCents: sgst, igstCents: 0 };
}

export function formatInrFromCents(cents: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2
  }).format(cents / 100);
}
