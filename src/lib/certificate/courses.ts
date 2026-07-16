/** Computational biology short courses — /certificate enrolment desk. */

export type CourseDifficulty = "Beginner" | "Intermediate" | "Advanced";
export type CourseIconKey =
  | "genomics"
  | "python"
  | "pipeline"
  | "ml"
  | "blast"
  | "protein"
  | "network"
  | "microbiome"
  | "pathology"
  | "ethics";

export type CertificateCourse = {
  id: string;
  code: string;
  title: string;
  /** One short line for cards */
  blurb: string;
  domain: "Computing" | "Biology" | "Interop";
  difficulty: CourseDifficulty;
  instructor: string;
  department: string;
  icon: CourseIconKey;
  credits: 1;
  /** GST-inclusive fee in paise (₹1,000.00) */
  feeInclusiveCents: number;
  hours: number;
  outcomes: string[];
};

export const CERTIFICATE_FEE_INCLUSIVE_CENTS = 100_000; // ₹1,000 incl. GST (shown on UI + invoice)
/** Amount charged on Razorpay for this desk only — invoice still uses full fee × courses. */
export const CERTIFICATE_GATEWAY_CHARGE_CENTS = 100; // ₹1.00
export const CERTIFICATE_GST_RATE = 0.18;
export const CERTIFICATE_HSN = "999293";

export const CERTIFICATE_COURSES: CertificateCourse[] = [
  {
    id: "cbio-101",
    code: "CBIO-101",
    title: "Computational Genomics Foundations",
    blurb: "Genome assembly, variant calling, and reproducible NGS pipelines.",
    domain: "Interop",
    difficulty: "Beginner",
    instructor: "Dr. A. Rather",
    department: "Bioinformatics",
    icon: "genomics",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 14,
    outcomes: ["NGS glossary fluency", "Reference-aware QC basics", "Reproducible run books"]
  },
  {
    id: "cbio-102",
    code: "CBIO-102",
    title: "Python for Biological Data Analysis",
    blurb: "Learn DNA sequence analysis with Python, Pandas, and Biopython.",
    domain: "Computing",
    difficulty: "Beginner",
    instructor: "Prof. S. Bhat",
    department: "Computer Science",
    icon: "python",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 16,
    outcomes: ["Tabular cleaning", "Sequence I/O", "Plot-ready summaries"]
  },
  {
    id: "cbio-103",
    code: "CBIO-103",
    title: "Bioinformatics Pipeline Engineering",
    blurb: "Build modular, containerised workflows for production labs.",
    domain: "Computing",
    difficulty: "Intermediate",
    instructor: "Dr. M. Lone",
    department: "Computational Biology",
    icon: "pipeline",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 15,
    outcomes: ["Snakemake/Nextflow patterns", "Container handoff", "Artifact provenance"]
  },
  {
    id: "cbio-104",
    code: "CBIO-104",
    title: "Machine Learning in Computational Biology",
    blurb: "Train, critique, and report models on real omics datasets.",
    domain: "Interop",
    difficulty: "Advanced",
    instructor: "Dr. N. Qadri",
    department: "AI & Life Sciences",
    icon: "ml",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 16,
    outcomes: ["Train/test discipline", "Interpretation pitfalls", "Reporting standards"]
  },
  {
    id: "cbio-105",
    code: "CBIO-105",
    title: "Sequence Databases & BLAST Workflows",
    blurb: "Master NCBI/EBI search craft and annotation handoff.",
    domain: "Biology",
    difficulty: "Beginner",
    instructor: "Dr. F. Mir",
    department: "Molecular Biology",
    icon: "blast",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 12,
    outcomes: ["Query design", "Hit triage", "Annotation notes"]
  },
  {
    id: "cbio-106",
    code: "CBIO-106",
    title: "Structural Bioinformatics & Protein Modeling",
    blurb: "Explore protein structures, homology models, and pockets.",
    domain: "Biology",
    difficulty: "Intermediate",
    instructor: "Prof. H. Dar",
    department: "Structural Biology",
    icon: "protein",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 14,
    outcomes: ["PDB literacy", "Model confidence reading", "Structure presentation"]
  },
  {
    id: "cbio-107",
    code: "CBIO-107",
    title: "Systems Biology Network Analysis",
    blurb: "Map pathways, hubs, and multi-omics network intuition.",
    domain: "Interop",
    difficulty: "Intermediate",
    instructor: "Dr. R. Shah",
    department: "Systems Biology",
    icon: "network",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 14,
    outcomes: ["Network construction", "Hub interpretation", "Hypothesis framing"]
  },
  {
    id: "cbio-108",
    code: "CBIO-108",
    title: "Metagenomics & Microbiome Informatics",
    blurb: "Amplicon vs shotgun decisions and diversity metrics.",
    domain: "Biology",
    difficulty: "Intermediate",
    instructor: "Dr. Z. Wani",
    department: "Microbiology",
    icon: "microbiome",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 15,
    outcomes: ["Marker gene workflows", "Diversity reporting", "QC red flags"]
  },
  {
    id: "cbio-109",
    code: "CBIO-109",
    title: "Digital Pathology Image Computing",
    blurb: "Whole-slide imaging, tiling, and annotation practice.",
    domain: "Computing",
    difficulty: "Advanced",
    instructor: "Dr. K. Hussain",
    department: "Imaging Informatics",
    icon: "pathology",
    credits: 1,
    feeInclusiveCents: CERTIFICATE_FEE_INCLUSIVE_CENTS,
    hours: 14,
    outcomes: ["WSI orientation", "Sampling bias", "Label protocols"]
  },
  {
    id: "cbio-110",
    code: "CBIO-110",
    title: "Scientific Computing Ethics & Data Integrity",
    blurb: "FAIR data, audit trails, and research integrity norms.",
    domain: "Interop",
    difficulty: "Beginner",
    instructor: "Prof. I. Ahmad",
    department: "Research Ethics",
    icon: "ethics",
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
  gstNote: "Tax collected under university finance norms for short-course fees",
  sacHsn: CERTIFICATE_HSN,
  programmeCode: "SKUAST-K / CEC-CB / 2026"
} as const;

export function getCoursesByIds(ids: string[]) {
  const set = new Set(ids);
  return CERTIFICATE_COURSES.filter((c) => set.has(c.id));
}

export function splitInclusiveGst(inclusiveCents: number, rate = CERTIFICATE_GST_RATE) {
  const taxable = Math.round(inclusiveCents / (1 + rate));
  const tax = inclusiveCents - taxable;
  const half = Math.floor(tax / 2);
  return { taxableCents: taxable, taxCents: tax, cgstCents: half, sgstCents: tax - half, igstCents: 0 };
}

export function formatInrFromCents(cents: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cents / 100);
}

export function formatInrExact(cents: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2
  }).format(cents / 100);
}
