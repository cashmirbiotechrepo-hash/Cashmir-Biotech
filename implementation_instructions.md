# Bioinformatics Tools — Complete Implementation Instructions

> [!IMPORTANT]
> This document covers **all 20 tool categories** (excluding #19 AI-Powered). Each tool entry includes: **biological purpose**, **core algorithm/logic**, **API route**, **input/output spec**, and **implementation prompt**. Tools must perform **real biological computations** — no fake/gimmick outputs.

---

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js (App Router) + React + Vanilla CSS
- **Backend**: Next.js API Routes (`/api/tools/[category]/[tool]`)
- **Computation**: Server-side Node.js with custom algorithm implementations
- **File Parsing**: Custom parsers for FASTA, FASTQ, GenBank, VCF, SAM, BAM, BED, GFF, PDB, Newick
- **Visualization**: D3.js for plots, Mol* for 3D protein, custom SVG for diagrams
- **State**: React Context for tool state, IndexedDB for large datasets client-side

### API Route Convention
```
POST /api/tools/{category}/{tool-slug}
```
- All tools accept `POST` with JSON body or `multipart/form-data` (for file uploads)
- Response: `{ success: boolean, data: {...}, error?: string }`

### Shared Utility Modules Needed
```
/lib/bio/
  ├── sequences.js      → Parse/validate DNA, RNA, Protein sequences
  ├── codons.js          → Codon tables, translation logic
  ├── matrices.js        → BLOSUM62, PAM250, NUC44 substitution matrices
  ├── parsers/
  │   ├── fasta.js
  │   ├── fastq.js
  │   ├── genbank.js
  │   ├── embl.js
  │   ├── vcf.js
  │   ├── sam.js
  │   ├── bed.js
  │   ├── gff.js
  │   ├── pdb.js
  │   └── newick.js
  ├── alignment.js       → Smith-Waterman, Needleman-Wunsch, banded alignment
  ├── phylo.js           → Tree algorithms (NJ, UPGMA, ML)
  ├── stats.js           → Statistical tests (t-test, chi-square, Fisher's exact)
  └── visualization.js   → Shared chart/plot utilities
```

---

# CATEGORY 1: Sequence Analysis

> **Priority: HIGHEST** — These are used every single day in bioinformatics.

---

## 1.1 BLAST Suite (BLASTN, BLASTP, BLASTX, TBLASTN, TBLASTX)

### Biological Purpose
BLAST (Basic Local Alignment Search Tool) finds regions of similarity between biological sequences. It compares nucleotide or protein sequences to databases and calculates the statistical significance of matches.

### Algorithm / Logic

**Core Algorithm: Seed-and-Extend**

```
1. WORD GENERATION (Seeding)
   - Break query into overlapping k-mers (words)
     - Nucleotide: k=11 (BLASTN), k=28 (megaBLAST)
     - Protein: k=3 (BLASTP)
   - For protein BLAST: generate "neighborhood words"
     Score each possible word against query word using BLOSUM62
     Keep words scoring ≥ threshold T (default T=11 for BLASTP)

2. DATABASE SCANNING
   - Build a hash table (lookup table) of all word positions in query
   - Scan database sequences, looking for exact matches to any query word
   - These matches = "hits" or "seeds"

3. EXTENSION (Two-Hit Method)
   - For each pair of hits on same diagonal within distance A:
     - Extend alignment in both directions using ungapped extension
     - Stop when score drops X_g below the best score seen
     - If score ≥ threshold S_g, proceed to gapped extension

4. GAPPED EXTENSION
   - Apply Smith-Waterman (dynamic programming) around the seed region
   - Use X_dropoff parameter to limit extension
   - Gap penalties: open = -11, extend = -1 (BLASTP defaults)

5. SCORING
   - Raw Score (S): Sum of substitution matrix scores minus gap penalties
   - Bit Score: S' = (λ·S - ln(K)) / ln(2)
     Where λ and K are Karlin-Altschul statistical parameters
   - E-value: E = m·n·2^(-S')
     Where m = query length, n = total database length
   - Lower E-value = more significant (E < 0.001 is typically significant)
```

**BLAST Variants:**

| Variant | Query | Database | Notes |
|---------|-------|----------|-------|
| BLASTN | Nucleotide | Nucleotide | Match/mismatch scoring (+2/-3 default) |
| BLASTP | Protein | Protein | Uses BLOSUM62 by default |
| BLASTX | Nucleotide (translated 6 frames) | Protein | Query translated in all 6 reading frames |
| TBLASTN | Protein | Nucleotide (translated 6 frames) | Database translated on-the-fly |
| TBLASTX | Nucleotide (translated) | Nucleotide (translated) | Both translated; very slow |

### API Route
```
POST /api/tools/sequence-analysis/blast
Body: {
  program: "blastn" | "blastp" | "blastx" | "tblastn" | "tblastx",
  query: string,          // FASTA format sequence
  database: string,       // User-uploaded FASTA or built-in (e.g., "swissprot_sample")
  evalue: number,         // E-value cutoff (default: 10)
  wordSize: number,       // k-mer size
  matrix: string,         // "BLOSUM62", "BLOSUM45", "PAM250"
  gapOpen: number,        // Gap opening penalty
  gapExtend: number,      // Gap extension penalty
  maxHits: number         // Maximum results to return
}
Response: {
  hits: [{
    subjectId: string,
    subjectDef: string,
    score: number,
    bitScore: number,
    evalue: number,
    identity: number,      // Percentage
    positives: number,     // Percentage (protein only)
    gaps: number,
    alignmentLength: number,
    queryStart: number,
    queryEnd: number,
    subjectStart: number,
    subjectEnd: number,
    queryAlignment: string,
    midline: string,
    subjectAlignment: string
  }],
  statistics: {
    database: string,
    dbSequences: number,
    dbLetters: number,
    lambda: number,
    kappa: number
  }
}
```

### Implementation Prompt
```
Implement a BLAST search engine in JavaScript/Node.js. The core algorithm must:

1. Parse FASTA input for both query and database sequences
2. Generate k-mer seeds from the query (k=11 for nucleotide, k=3 for protein)
3. For protein: generate neighborhood words scoring ≥ threshold T against BLOSUM62
4. Build a hash index of all k-mer positions in the database
5. Find seed hits (exact k-mer matches between query words and database)
6. Apply the two-hit method: only extend when two hits occur on the same
   diagonal within distance A
7. Perform ungapped extension with X-dropoff
8. Perform gapped extension using Smith-Waterman dynamic programming
9. Calculate raw score, bit score, and E-value using Karlin-Altschul statistics
10. Return alignments sorted by E-value

Include full BLOSUM62 and NUC44 substitution matrices as constants.
Support all 5 BLAST programs by handling the translation logic for BLASTX/TBLASTN/TBLASTX.
The E-value calculation must be statistically correct using:
  E = m * n * 2^(-bit_score)
where m = effective query length, n = effective database size.
```

---

## 1.2 PSI-BLAST (Position-Specific Iterated BLAST)

### Biological Purpose
Detects distant homologs by building a Position-Specific Scoring Matrix (PSSM) from initial BLASTP results and iterating.

### Algorithm / Logic
```
1. Run standard BLASTP with query against database
2. Collect hits below E-value inclusion threshold (default 0.005)
3. Build a multiple alignment from significant hits
4. Calculate Position-Specific Scoring Matrix (PSSM):
   For each position i in the query:
     For each amino acid a:
       PSSM[i][a] = (1/λ) * ln( Σ(weighted frequency of a at position i) / background frequency of a )
   
   Weighted frequencies use sequence weighting (Henikoff & Henikoff weights):
     - Count distinct amino acids at each position
     - Weight = 1 / (number_of_different_AAs × count_of_this_AA)

5. Use PSSM instead of BLOSUM62 for next iteration of BLAST
6. Repeat steps 2-5 for specified number of iterations or until convergence
   (convergence = no new sequences added)
```

### API Route
```
POST /api/tools/sequence-analysis/psi-blast
Body: {
  query: string,
  database: string,
  iterations: number,     // Default: 3
  inclusionEvalue: number, // Default: 0.005
  ...standard BLAST params
}
Response: {
  iterations: [{
    round: number,
    newSequences: number,
    pssm: number[][],     // 20 × query_length matrix
    hits: [... same as BLAST ...]
  }],
  converged: boolean,
  finalPSSM: number[][]
}
```

### Implementation Prompt
```
Implement PSI-BLAST iterative search:
1. Start with standard BLASTP
2. Build PSSM from significant alignments using Henikoff sequence weighting
3. PSSM calculation: For each query position, calculate log-odds scores for all 
   20 amino acids based on observed frequencies vs background frequencies
4. Use pseudocounts (α = number_of_sequences / (number_of_sequences + β), β = 10)
   to avoid zero probabilities
5. Re-search database using PSSM instead of substitution matrix
6. Iterate until convergence or max iterations reached
7. Track which sequences are newly included in each round
```

---

## 1.3 DELTA-BLAST (Domain Enhanced Lookup Time Accelerated BLAST)

### Biological Purpose
Uses conserved domain database (CDD) to construct a PSSM before the first search, improving sensitivity for remote homologs even with a single query.

### Algorithm / Logic
```
1. Search query against Conserved Domain Database (CDD) using RPS-BLAST
2. From domain hits, construct initial PSSM
3. Use this PSSM (instead of BLOSUM62) for the first-round database search
4. Proceed like PSI-BLAST with PSSM refinement

Key: Instead of PSI-BLAST's cold start with BLOSUM62,
DELTA-BLAST has an informed start from domain profiles.
```

### API Route
```
POST /api/tools/sequence-analysis/delta-blast
Body: {
  query: string,
  database: string,
  cddDatabase: string,   // Conserved domain profiles
  ...standard BLAST params
}
```

### Implementation Prompt
```
Implement DELTA-BLAST by:
1. Pre-build a small conserved domain database (CDD) from Pfam/CDD profiles
2. Search query against CDD profiles using RPS-BLAST (reverse position-specific BLAST)
3. Construct an initial PSSM from domain alignments
4. Use this PSSM for first-round database search (instead of BLOSUM62)
5. Optionally iterate like PSI-BLAST
The key innovation is the domain-informed initial PSSM, which makes the first round
more sensitive than standard BLASTP or PSI-BLAST round 1.
```

---

## 1.4 FASTA Search

### Biological Purpose
An alternative to BLAST with different sensitivity/speed trade-offs. Uses the FASTA algorithm (Lipman-Pearson) which can detect more distant relationships.

### Algorithm / Logic
```
1. KTUP SCANNING
   - Identify exact matches of length ktup (k=6 for DNA, k=2 for protein)
   - Using a hash/lookup table

2. INITIAL REGIONS (init1 score)
   - Find diagonal runs of ktup matches
   - Score each diagonal using substitution matrix
   - Keep top 10 scoring diagonals

3. OPTIMIZED SCORE (initn)
   - Join nearby diagonal regions with gap penalties
   - Score the joined region

4. SMITH-WATERMAN BAND (opt score)
   - Apply banded Smith-Waterman around the best region
   - Band width = 32 residues around the best diagonal

5. STATISTICAL EVALUATION
   - Calculate Z-scores: Z = (S - mean) / std_dev
   - Convert to E-values using extreme value distribution
```

### API Route
```
POST /api/tools/sequence-analysis/fasta-search
Body: {
  query: string,
  database: string,
  ktup: number,           // 1-6 (default: 6 DNA, 2 protein)
  sequenceType: "dna" | "protein",
  gapOpen: number,
  gapExtend: number
}
```

### Implementation Prompt
```
Implement the FASTA search algorithm (Lipman-Pearson):
1. Build lookup table of all ktup-mers in the database
2. For each database sequence, find shared ktup matches on each diagonal
3. Score diagonals using substitution matrix, keep top 10
4. Merge nearby high-scoring diagonals with gap penalties (initn score)
5. Apply banded Smith-Waterman (band=32) around best region (opt score)
6. Calculate Z-scores and E-values for statistical significance
The FASTA algorithm differs from BLAST in using smaller k-mers (ktup=2 for protein)
making it slightly more sensitive but slower.
```

---

## 1.5 LAST (Large-Scale Alignment Search Tool)

### Biological Purpose
Designed for large genome-to-genome alignments. Handles very large sequences efficiently using adaptive seed frequencies.

### Algorithm / Logic
```
1. Build a suffix array of the database (memory efficient for large genomes)
2. Use adaptive seeds: seed frequency adapts to sequence composition
   - In repetitive regions: require longer seeds
   - In unique regions: accept shorter seeds
3. Extend seeds using a gapped alignment with affine gap penalties
4. Score using a substitution matrix (DNA or protein)
5. Statistical significance via ALP (Accurate Library of Parameters)

Key difference from BLAST: 
- Uses suffix arrays instead of hash tables
- Adaptive seeding handles repeats better
- Can align sequences of very different sizes
```

### API Route
```
POST /api/tools/sequence-analysis/last
Body: {
  query: string,           // Large genome sequence (FASTA)
  database: string,
  seedFrequency: "adaptive" | "fixed",
  matchScore: number,
  mismatchPenalty: number,
  gapOpen: number,
  gapExtend: number
}
```

---

## 1.6 Smith-Waterman (Local Alignment)

### Biological Purpose
Finds the best local alignment between two sequences. Guaranteed to find the optimal local alignment (unlike BLAST which is heuristic).

### Algorithm / Logic
```
DYNAMIC PROGRAMMING MATRIX:

Given sequences: s (length m) and t (length n)
Scoring: match/mismatch from substitution matrix, gap penalties (affine)

Initialize:
  H[i][0] = 0 for all i    (KEY DIFFERENCE from Needleman-Wunsch)
  H[0][j] = 0 for all j

For affine gaps, use three matrices:
  H[i][j] = max(0,                                    // Reset to 0 (local)
                 H[i-1][j-1] + score(s[i], t[j]),     // Match/mismatch
                 E[i][j],                               // Gap in sequence s
                 F[i][j])                               // Gap in sequence t
  
  E[i][j] = max(H[i][j-1] - (gap_open + gap_extend),  // Open new gap
                 E[i][j-1] - gap_extend)                // Extend existing gap
  
  F[i][j] = max(H[i-1][j] - (gap_open + gap_extend),
                 F[i-1][j] - gap_extend)

Traceback:
  Start from the cell with maximum score in entire matrix
  Follow traceback pointers until a cell with score 0 is reached

Scoring matrices:
  DNA: NUC44 or simple match=+2, mismatch=-3
  Protein: BLOSUM62, BLOSUM45, PAM250

Time: O(m × n)
Space: O(m × n), can be reduced to O(min(m,n)) with Hirschberg's trick
```

### API Route
```
POST /api/tools/sequence-analysis/smith-waterman
Body: {
  sequence1: string,
  sequence2: string,
  sequenceType: "dna" | "protein",
  matrix: "BLOSUM62" | "BLOSUM45" | "PAM250" | "NUC44" | "IDENTITY",
  gapOpen: number,        // Default: -10 (protein), -5 (DNA)
  gapExtend: number,      // Default: -1
  matchScore: number,     // For DNA simple scoring
  mismatchScore: number
}
Response: {
  score: number,
  identity: number,
  similarity: number,
  gaps: number,
  alignmentLength: number,
  alignment: {
    seq1Aligned: string,
    midline: string,
    seq2Aligned: string,
    seq1Start: number,
    seq1End: number,
    seq2Start: number,
    seq2End: number
  },
  matrix: number[][]      // Optional: full DP matrix for visualization
}
```

### Implementation Prompt
```
Implement the Smith-Waterman local alignment algorithm with:
1. Affine gap penalties (separate open and extend costs) using 3-matrix formulation
   (H, E, F matrices)
2. Support for multiple substitution matrices: BLOSUM62, BLOSUM45, PAM250, NUC44
   (embed full matrices as constants)
3. Traceback from global maximum cell to first zero-cell
4. Calculate: alignment score, percent identity, percent similarity, gap count
5. Return the aligned sequences with gap characters ('-')
6. For DNA: support simple match/mismatch scoring or matrix-based scoring
7. For protein: always use substitution matrix scoring
8. Optimize: for sequences > 5000 residues, use banded alignment (band width = 
   2 * sqrt(max(m,n)))
```

---

## 1.7 Needleman-Wunsch (Global Alignment)

### Biological Purpose
Finds the best global alignment between two sequences, aligning them end-to-end.

### Algorithm / Logic
```
Same DP formulation as Smith-Waterman EXCEPT:

1. Initialization:
   H[i][0] = gap_open + i * gap_extend    (NOT zero)
   H[0][j] = gap_open + j * gap_extend

2. Recurrence:
   H[i][j] = max(H[i-1][j-1] + score(s[i], t[j]),   // NO zero option
                  E[i][j],
                  F[i][j])

3. Traceback:
   Start from H[m][n] (bottom-right corner, NOT maximum)
   Trace back to H[0][0] (top-left corner)

This forces the entire sequences to be aligned end-to-end.
```

### API Route
```
POST /api/tools/sequence-analysis/needleman-wunsch
Body: { ...same as Smith-Waterman... }
Response: { ...same format, but alignment covers full sequences... }
```

---

## 1.8 Pairwise Alignment (DNA×DNA, Protein×Protein, DNA×Protein)

### Biological Purpose
Unified tool for aligning two sequences of potentially different types.

### Algorithm / Logic
```
DNA vs DNA:
  - Direct Needleman-Wunsch or Smith-Waterman
  - Scoring: NUC44 or match/mismatch

Protein vs Protein:
  - Direct NW or SW
  - Scoring: BLOSUM62, PAM250

DNA vs Protein:
  - Translate DNA in all 6 reading frames
  - Align each frame's protein to the protein query
  - Return the best-scoring frame alignment
  - Six frames: +1, +2, +3 (forward), -1, -2, -3 (reverse complement)
```

### API Route
```
POST /api/tools/sequence-analysis/pairwise-alignment
Body: {
  sequence1: string,
  seq1Type: "dna" | "protein",
  sequence2: string,
  seq2Type: "dna" | "protein",
  alignmentType: "local" | "global",
  matrix: string,
  gapOpen: number,
  gapExtend: number
}
```

---

## 1.9 Multiple Sequence Alignment (Clustal Omega, MUSCLE, MAFFT, T-Coffee)

### Biological Purpose
Align 3+ sequences simultaneously to find conserved regions, infer evolutionary relationships, and identify functional domains.

### Algorithm / Logic

**Clustal Omega (Progressive Alignment):**
```
1. PAIRWISE DISTANCES
   - Align all pairs using k-mer counting (fast, approximate)
   - Calculate distance = 1 - (shared_kmers / total_kmers)

2. GUIDE TREE
   - Build UPGMA or Neighbor-Joining tree from distance matrix
   - This determines the order of alignment

3. PROGRESSIVE ALIGNMENT (following guide tree)
   - Start at leaves, work toward root
   - At each internal node: align the two child alignments
   - Profile-to-profile alignment using sum-of-pairs scoring
   
   Profile scoring:
     Score(column_A, column_B) = Σ Σ w_i * w_j * matrix[a_i][b_j]
     for all residues a_i in column A and b_j in column B
     w = sequence weights (Henikoff method)

4. ITERATION (optional)
   - Remove each sequence from alignment
   - Re-align it to the profile of remaining sequences
   - Repeat until no improvement
```

**MUSCLE Algorithm:**
```
1. DRAFT PROGRESSIVE
   - k-mer distance → UPGMA tree → progressive alignment

2. IMPROVED PROGRESSIVE  
   - Compute Kimura distances from draft alignment
   - Build new UPGMA tree
   - If tree topology changed: re-do progressive alignment

3. REFINEMENT
   - Divide alignment into two groups by removing a tree edge
   - Re-align the two profiles
   - Keep if score improves
   - Repeat for all edges
```

**MAFFT Algorithm:**
```
FFT-based: 
  - Convert sequences to vectors of amino acid properties
  - Use Fast Fourier Transform to find homologous segments
  - Build guide tree and perform progressive alignment
  
L-INS-i (most accurate):
  - Pairwise all-vs-all local alignments (Smith-Waterman)
  - Build guide tree
  - Progressive alignment with consistency transformation
  - Iterate until convergence
```

**T-Coffee Algorithm:**
```
1. LIBRARY GENERATION
   - Generate pairwise alignments (both local and global)
   - Each aligned pair of residues gets a weight = alignment score

2. LIBRARY EXTENSION (Consistency)
   - For each pair (a_i, b_j), check if there exists c_k such that
     (a_i, c_k) and (c_k, b_j) are also in the library
   - Extended weight = original + Σ min(weight(a_i,c_k), weight(c_k,b_j))
   
3. PROGRESSIVE ALIGNMENT
   - Use extended library weights for scoring instead of substitution matrix
```

### API Route
```
POST /api/tools/sequence-analysis/msa
Body: {
  sequences: string,       // Multi-FASTA format
  method: "clustal" | "muscle" | "mafft" | "tcoffee",
  sequenceType: "dna" | "protein",
  iterations: number,      // Refinement iterations
  gapOpen: number,
  gapExtend: number,
  matrix: string,
  outputFormat: "fasta" | "clustal" | "msf"
}
Response: {
  alignment: string,        // Aligned sequences in chosen format
  consensusSequence: string,
  conservationScores: number[], // Per-column conservation (0-1)
  guideTree: string,        // Newick format
  identityMatrix: number[][], // Pairwise identity matrix
  score: number             // Sum-of-pairs score
}
```

### Implementation Prompt
```
Implement Multiple Sequence Alignment with at minimum the Clustal Omega progressive 
alignment approach:

1. PAIRWISE DISTANCES: For N sequences, compute N×(N-1)/2 pairwise distances using
   k-mer counting (k=6 for DNA, k=3 for protein). Distance = 1 - (shared k-mers / 
   min total k-mers of either sequence).

2. GUIDE TREE: Build Neighbor-Joining tree from the distance matrix. Output in Newick
   format.

3. PROGRESSIVE ALIGNMENT: Traverse the guide tree from leaves to root. At each internal
   node, align the two child groups using profile-profile alignment:
   - Profile = frequency of each residue at each column position
   - Score two profile columns using sum-of-pairs: 
     SOP = Σ_i Σ_j f(a_i) × f(b_j) × BLOSUM62[a_i][b_j]
   - Use Needleman-Wunsch with profile scoring
   - Apply position-specific gap penalties (reduce penalty near existing gaps)

4. REFINEMENT: For each sequence, remove it from the alignment, realign it to the 
   remaining profile. Accept if sum-of-pairs score improves. Repeat for max_iterations.

5. OUTPUTS: Conservation scores per column (count of most frequent residue / total),
   consensus sequence (most frequent residue per column, threshold ≥ 50%),
   pairwise identity matrix.
```

---

## 1.10 Sequence Identity Matrix

### Algorithm / Logic
```
For N aligned sequences:
  For each pair (i, j):
    identity = (number of identical positions) / (alignment length excluding double-gaps)
    
Output: N × N symmetric matrix with 100% on diagonal
```

### API Route
```
POST /api/tools/sequence-analysis/identity-matrix
Body: { alignment: string }  // Pre-aligned FASTA
Response: { matrix: number[][], labels: string[] }
```

---

## 1.11 Conserved Region Finder

### Algorithm / Logic
```
Given a multiple sequence alignment:
1. Calculate conservation score at each column:
   - Shannon entropy: H = -Σ p_i × log2(p_i), where p_i = frequency of amino acid i
   - Conservation = max_entropy - H (higher = more conserved)
   
2. Apply sliding window (default window=10):
   - Average conservation scores across window
   
3. Report regions where average conservation > threshold (e.g., > 0.7)

4. Map conserved regions back to individual sequence coordinates
```

### API Route
```
POST /api/tools/sequence-analysis/conserved-regions
Body: {
  alignment: string,
  windowSize: number,       // Default: 10
  threshold: number,        // Default: 0.7 (conservation score 0-1)
  method: "entropy" | "identity" | "blosum"
}
Response: {
  regions: [{ start: number, end: number, score: number, sequence: string }],
  perColumnScores: number[]
}
```

---

## 1.12 Consensus Sequence Generator

### Algorithm / Logic
```
For each column in a multiple sequence alignment:
  1. Count frequency of each residue (excluding gaps)
  2. Consensus residue = most frequent residue
  3. Apply threshold:
     - If top frequency ≥ threshold: uppercase letter
     - If top frequency ≥ 50%: lowercase letter
     - If no residue ≥ 50%: 'X' (protein) or 'N' (DNA)
  4. IUPAC ambiguity codes (DNA): if two nucleotides each ≥ 30%,
     use ambiguity code (R, Y, M, K, S, W, etc.)
```

### API Route
```
POST /api/tools/sequence-analysis/consensus
Body: {
  alignment: string,
  threshold: number,        // Default: 0.7
  useAmbiguity: boolean,   // Use IUPAC codes for DNA
  sequenceType: "dna" | "protein"
}
Response: {
  consensus: string,
  quality: string           // Quality string showing conservation per position
}
```

---

## 1.13 Reverse Complement

### Algorithm / Logic
```
1. Complement map:
   A↔T, C↔G, G↔C, T↔A
   R↔Y, M↔K, S↔S, W↔W, H↔D, B↔V, N↔N

2. Reverse the complemented string

Example: 5'-ATGCTA-3' → complement: TACGAT → reverse: TAGCAT → 5'-TAGCAT-3'
```

### API Route
```
POST /api/tools/sequence-analysis/reverse-complement
Body: { sequence: string, operation: "reverse" | "complement" | "reverse-complement" }
Response: { result: string }
```

---

## 1.14 DNA ↔ RNA Conversion

### Algorithm / Logic
```
DNA → RNA: Replace all T with U
RNA → DNA: Replace all U with T
Case-preserving: t→u, T→U (and reverse)
```

### API Route
```
POST /api/tools/sequence-analysis/dna-rna-convert
Body: { sequence: string, direction: "dna-to-rna" | "rna-to-dna" }
```

---

## 1.15 Translation (DNA → Protein)

### Biological Purpose
Translate a DNA/RNA sequence into protein using the genetic code.

### Algorithm / Logic
```
Standard Genetic Code (Table 1):
  TTT→F  TTC→F  TTA→L  TTG→L
  CTT→L  CTC→L  CTA→L  CTG→L
  ATT→I  ATC→I  ATA→I  ATG→M (START)
  GTT→V  GTC→V  GTA→V  GTG→V
  TCT→S  TCC→S  TCA→S  TCG→S
  CCT→P  CCC→P  CCA→P  CCG→P
  ACT→T  ACC→T  ACA→T  ACG→T
  GCT→A  GCC→A  GCA→A  GCG→A
  TAT→Y  TAC→Y  TAA→*  TAG→*  (STOP)
  CAT→H  CAC→H  CAA→Q  CAG→Q
  AAT→N  AAC→N  AAA→K  AAG→K
  GAT→D  GAC→D  GAA→E  GAG→E
  TGT→C  TGC→C  TGA→*  TGG→W  (STOP)
  CGT→R  CGC→R  CGA→R  CGG→R
  AGT→S  AGC→S  AGA→R  AGG→R
  GGT→G  GGC→G  GGA→G  GGG→G

Also support: Vertebrate Mitochondrial, Yeast Mitochondrial, etc. (NCBI tables 1-33)

Algorithm:
1. If RNA, convert U→T first
2. Read sequence in triplets (codons) from specified reading frame
3. Translate each codon using the genetic code table
4. Stop at stop codon (TAA, TAG, TGA) or end of sequence
```

### API Route
```
POST /api/tools/sequence-analysis/translate
Body: {
  sequence: string,
  frame: 1 | 2 | 3,        // Reading frame offset (0-based: 0, 1, 2)
  geneticCode: number,      // NCBI table number (default: 1)
  stopAtStopCodon: boolean,  // Default: true
  inputType: "dna" | "rna"
}
Response: {
  protein: string,
  codons: string[],
  stopPosition: number | null
}
```

---

## 1.16 Six Frame Translation

### Algorithm / Logic
```
1. Forward strand: translate in frames +1, +2, +3
   Frame +1: positions 0, 3, 6, 9...
   Frame +2: positions 1, 4, 7, 10...
   Frame +3: positions 2, 5, 8, 11...

2. Reverse complement the sequence

3. Reverse strand: translate in frames -1, -2, -3
   Same position offsets on the reverse complement

Each frame produces an independent protein sequence with stop codons marked as '*'
```

### API Route
```
POST /api/tools/sequence-analysis/six-frame-translation
Body: { sequence: string, geneticCode: number }
Response: {
  frames: {
    "+1": string, "+2": string, "+3": string,
    "-1": string, "-2": string, "-3": string
  }
}
```

---

## 1.17 ORF Finder (Open Reading Frame Finder)

### Algorithm / Logic
```
1. Translate sequence in all 6 reading frames
2. For each frame, find all ORFs:
   - Start: ATG codon (or alternative starts: GTG, TTG for prokaryotes)
   - End: Stop codon (TAA, TAG, TGA) or end of sequence
   - Minimum length filter (default: 100 codons / 300 nt)
3. For each ORF record:
   - Frame (+1/+2/+3/-1/-2/-3)
   - Start position (in nucleotide coordinates)
   - End position
   - Length (amino acids)
   - Translated protein sequence
4. Sort by length (longest first) or by position
5. Optionally: detect nested ORFs (ORFs within ORFs)
```

### API Route
```
POST /api/tools/sequence-analysis/orf-finder
Body: {
  sequence: string,
  minLength: number,          // Minimum ORF length in codons (default: 100)
  geneticCode: number,
  startCodons: string[],      // Default: ["ATG"]
  allowAlternativeStarts: boolean,
  nestedOrfs: boolean         // Include ORFs within larger ORFs
}
Response: {
  orfs: [{
    frame: string,
    start: number,            // Nucleotide position
    end: number,
    lengthAA: number,
    protein: string,
    startCodon: string,
    stopCodon: string | null
  }]
}
```

---

## 1.18 Codon Usage Calculator

### Algorithm / Logic
```
1. Parse coding sequence (must be divisible by 3)
2. Count each codon occurrence
3. Group codons by amino acid they encode
4. Calculate:
   - Absolute count of each codon
   - Frequency per thousand codons: (count / total_codons) × 1000
   - Relative Synonymous Codon Usage (RSCU):
     RSCU = observed_count / expected_count
     expected_count = total_count_for_amino_acid / number_of_synonymous_codons
     RSCU = 1.0 means no bias; >1.0 means preferred; <1.0 means avoided
   - Codon Adaptation Index (CAI) for comparison to reference organisms
```

### API Route
```
POST /api/tools/sequence-analysis/codon-usage
Body: {
  sequence: string,
  geneticCode: number,
  referenceOrganism: string   // Optional: "ecoli", "human", "yeast"
}
Response: {
  codons: {
    [codon: string]: {
      aminoAcid: string,
      count: number,
      frequency: number,       // Per 1000
      rscu: number
    }
  },
  totalCodons: number,
  cai: number                  // Codon Adaptation Index (if reference provided)
}
```

---

## 1.19 Codon Optimization

### Algorithm / Logic
```
1. Input: protein sequence + target organism
2. Load codon usage table for target organism:
   - Pre-computed from highly expressed genes in the organism
   - Available: E. coli, Human, Yeast, CHO, Mouse, etc.
3. For each amino acid in the protein:
   - Select the most frequently used codon for that amino acid in the target organism
   - OR use weighted random selection based on codon frequencies (more natural)
4. Optimization constraints:
   - Avoid runs of same nucleotide > 5
   - Avoid strong secondary structures (check for complementary palindromes > 8bp)
   - Avoid restriction sites (user-specified list)
   - Maintain GC content within 40-60% (or organism-specific range)
   - Remove mRNA instability motifs (ATTTA)
   - Avoid internal Shine-Dalgarno sequences (prokaryotes)
5. Calculate CAI of optimized sequence
```

### API Route
```
POST /api/tools/sequence-analysis/codon-optimization
Body: {
  proteinSequence: string,
  targetOrganism: string,
  avoidSites: string[],        // Restriction sites to avoid
  gcRange: [number, number],   // e.g., [0.4, 0.6]
  strategy: "most-frequent" | "weighted-random"
}
Response: {
  optimizedDNA: string,
  cai: number,
  gcContent: number,
  codonChanges: number
}
```

---

## 1.20 GC Content Calculator

### Algorithm / Logic
```
Simple: GC% = (G + C) / (A + T + G + C) × 100

Sliding window GC content:
  For window starting at each position:
    GC% = (G + C in window) / window_size × 100
  This creates a GC content plot along the sequence

Also calculate:
  - AT content = 100 - GC%
  - GC content per codon position (1st, 2nd, 3rd) for coding sequences
  - GC3 (GC at 3rd codon position) — indicator of codon usage bias
```

### API Route
```
POST /api/tools/sequence-analysis/gc-content
Body: {
  sequence: string,
  windowSize: number,         // For sliding window (default: 100)
  step: number                // Step size for sliding window (default: 1)
}
Response: {
  gcContent: number,          // Overall percentage
  atContent: number,
  gcProfile: number[],        // Sliding window values
  positions: number[],        // x-axis for profile
  perCodonPosition: { gc1: number, gc2: number, gc3: number } // if length%3==0
}
```

---

## 1.21 AT/GC Skew

### Algorithm / Logic
```
GC Skew = (G - C) / (G + C) at each position/window
AT Skew = (A - T) / (A + T) at each position/window

Sliding window calculation:
  For each window of size w starting at position i:
    g = count of G in window
    c = count of C in window
    gc_skew[i] = (g - c) / (g + c)  // Range: -1 to +1

Cumulative GC Skew:
  cumulative[i] = cumulative[i-1] + gc_skew[i]
  Used to find the origin of replication (minimum of cumulative GC skew)
  
Biological significance:
  - Leading strand tends to have positive GC skew (more G than C)
  - Lagging strand tends to have negative GC skew
  - The switch point indicates the origin/terminus of replication
```

### API Route
```
POST /api/tools/sequence-analysis/skew
Body: {
  sequence: string,
  windowSize: number,
  step: number,
  type: "gc" | "at" | "both",
  cumulative: boolean
}
Response: {
  gcSkew: number[],
  atSkew: number[],
  cumulativeGcSkew: number[],
  positions: number[],
  oriEstimate: number         // Estimated origin of replication position
}
```

---

## 1.22 Melting Temperature (Tm) Calculator

### Algorithm / Logic
```
METHOD 1: Basic (sequences < 14bp):
  Tm = 2°C × (A + T) + 4°C × (G + C)    (Wallace rule)

METHOD 2: Salt-adjusted:
  Tm = 81.5 + 16.6 × log10([Na+]) + 41 × (nG + nC)/(N) - 675/N
  Where N = total length, [Na+] = sodium concentration

METHOD 3: Nearest-Neighbor (most accurate):
  Tm = (ΔH × 1000) / (ΔS + R × ln(Ct/4)) - 273.15
  
  Where:
    ΔH = Σ(nearest-neighbor enthalpy values)
    ΔS = Σ(nearest-neighbor entropy values) + initiation parameters
    R = 1.987 cal/(mol·K)
    Ct = total oligonucleotide concentration
    
  Nearest-neighbor parameters (SantaLucia, 1998):
    AA/TT: ΔH=-7.9, ΔS=-22.2
    AT/TA: ΔH=-7.2, ΔS=-20.4
    TA/AT: ΔH=-7.2, ΔS=-21.3
    CA/GT: ΔH=-8.5, ΔS=-22.7
    GT/CA: ΔH=-8.4, ΔS=-22.4
    CT/GA: ΔH=-7.8, ΔS=-21.0
    GA/CT: ΔH=-8.2, ΔS=-22.2
    CG/GC: ΔH=-10.6, ΔS=-27.2
    GC/CG: ΔH=-9.8, ΔS=-24.4
    GG/CC: ΔH=-8.0, ΔS=-19.9
    (all in kcal/mol and cal/mol·K)

  Salt correction (SantaLucia, 2004):
    ΔS_corrected = ΔS + 0.368 × (N-1) × ln([Na+])

  Mismatches: Use mismatch nearest-neighbor parameters if applicable
```

### API Route
```
POST /api/tools/sequence-analysis/melting-temperature
Body: {
  sequence: string,
  complement: string,          // Optional (for mismatches)
  method: "basic" | "salt" | "nearest-neighbor",
  naConcentration: number,     // mM (default: 50)
  oligoConcentration: number,  // nM (default: 250)
  mgConcentration: number      // mM (default: 0)
}
Response: {
  tm: number,                  // Melting temperature in °C
  deltaH: number,              // kcal/mol
  deltaS: number,              // cal/mol·K
  deltaG: number               // kcal/mol at 37°C
}
```

---

## 1.23 Molecular Weight Calculator

### Algorithm / Logic
```
DNA:
  MW = Σ(weight of each nucleotide) - (N-1) × 18.02 (water lost per bond)
  
  Nucleotide MWs (as monophosphate):
    dAMP: 331.22  dCMP: 307.18  dGMP: 347.22  dTMP: 322.21
  
  Single-stranded: subtract terminal phosphate or add OH depending on ends
  Double-stranded: calculate both strands, sum them

RNA:
  rAMP: 347.22  rCMP: 323.20  rGMP: 363.22  rUMP: 324.18

Protein:
  MW = Σ(weight of each amino acid) - (N-1) × 18.02
  
  Amino acid average MWs:
  G:57.05  A:71.08  V:99.13  L:113.16  I:113.16  P:97.12
  F:147.18  W:186.21  M:131.20  S:87.08  T:101.10  C:103.14
  Y:163.18  H:137.14  D:115.09  E:129.12  N:114.10  Q:128.13
  K:128.17  R:156.19
```

### API Route
```
POST /api/tools/sequence-analysis/molecular-weight
Body: {
  sequence: string,
  sequenceType: "dna" | "rna" | "protein",
  topology: "linear" | "circular",        // DNA only
  strandedness: "single" | "double"       // DNA only
}
Response: {
  molecularWeight: number,    // Daltons
  kDa: number,
  numberOfResidues: number
}
```

---

## 1.24 Restriction Site Finder

### Algorithm / Logic
```
1. Database of restriction enzymes with their recognition sequences:
   EcoRI: GAATTC (cut: G^AATTC / CTTAA^G)
   BamHI: GGATCC (cut: G^GATCC / CCTAG^G)
   HindIII: AAGCTT (cut: A^AGCTT / TTCGA^A)
   NotI: GCGGCCGC
   XhoI: CTCGAG
   ... (include 500+ common enzymes from REBASE)

2. Handle IUPAC ambiguity codes in recognition sites:
   R=[AG], Y=[CT], M=[AC], K=[GT], S=[GC], W=[AT]
   B=[CGT], D=[AGT], H=[ACT], V=[ACG], N=[ACGT]

3. Search algorithm:
   - Convert recognition sequence to regex handling IUPAC codes
   - Search both forward and reverse complement strands
   - Record: enzyme name, position, cut site, fragment sizes

4. Calculate resulting fragments:
   - Sort cut positions
   - Fragment sizes = differences between consecutive cut positions
   - For linear DNA: include terminal fragments
   - For circular DNA: the last fragment wraps around
```

### API Route
```
POST /api/tools/sequence-analysis/restriction-sites
Body: {
  sequence: string,
  enzymes: string[],           // Enzyme names, or "all" for comprehensive search
  topology: "linear" | "circular",
  minCuts: number,             // Filter: minimum cuts (default: 1)
  maxCuts: number              // Filter: maximum cuts (default: unlimited)
}
Response: {
  sites: [{
    enzyme: string,
    recognitionSite: string,
    position: number,
    strand: "+" | "-",
    cutPosition5: number,      // Cut position on 5' strand
    cutPosition3: number,      // Cut position on 3' strand
    overhang: "5'" | "3'" | "blunt",
    overhangSequence: string
  }],
  fragments: {
    [enzyme: string]: number[]  // Fragment sizes
  }
}
```

---

## 1.25 Restriction Digest Simulator

### Algorithm / Logic
```
1. Find all cut sites for selected enzymes (using Restriction Site Finder logic)
2. Sort all cut positions
3. Calculate fragments:
   - For single enzyme: simple fragmentation
   - For double digest: merge cut sites from both enzymes, then fragment
   - For partial digest: enumerate all possible subsets of cuts
4. Predict gel electrophoresis migration:
   - log10(fragment_size) is approximately linear with migration distance
   - Compare with standard DNA ladder (e.g., 1kb ladder)
   - Generate virtual gel image
```

### API Route
```
POST /api/tools/sequence-analysis/restriction-digest
Body: {
  sequence: string,
  enzymes: string[],           // 1-3 enzymes
  topology: "linear" | "circular",
  digestType: "complete" | "partial"
}
Response: {
  fragments: [{
    size: number,
    start: number,
    end: number,
    sequence: string
  }],
  gelData: {
    lanes: [{
      label: string,
      bands: [{ size: number, intensity: number }]
    }],
    ladder: [{ size: number, label: string }]
  }
}
```

---

## 1.26 Primer Design

### Algorithm / Logic
```
1. INPUT: Target sequence + region to amplify (start, end positions)

2. FORWARD PRIMER DESIGN:
   a. Extract candidate region (20bp upstream of amplicon start)
   b. Test primer lengths 18-30 bp
   c. For each candidate, check:
      - Tm: should be 55-65°C (nearest-neighbor method)
      - GC content: 40-60%
      - GC clamp: last 2 bases should include at least 1 G/C
      - No runs of ≥ 4 identical nucleotides
      - 3' end stability: ΔG of last 5 bases should be > -9 kcal/mol
      
3. REVERSE PRIMER DESIGN:
   Same criteria, designed on the reverse complement from amplicon end

4. PRIMER PAIR COMPATIBILITY:
   a. Tm difference between F and R: < 5°C (ideally < 2°C)
   b. No 3' complementarity (self-dimer, cross-dimer):
      Check for complementary stretches ≥ 4bp at 3' ends
   c. Self-complementarity score: align primer to its reverse complement
      Score < threshold (no stable hairpins with Tm > 40°C)
   d. Product size check
   
5. SELF-DIMER CHECK:
   - Align primer to itself in anti-parallel orientation
   - Calculate ΔG of any complementary regions
   - Reject if ΔG < -6 kcal/mol
   
6. HAIRPIN CHECK:
   - Fold primer on itself
   - Find palindromic regions ≥ 4bp
   - Calculate stem Tm; reject if Tm > 40°C

7. SCORING:
   Combined score based on all criteria
   Return top N primer pairs ranked by score
```

### API Route
```
POST /api/tools/sequence-analysis/primer-design
Body: {
  sequence: string,
  targetStart: number,
  targetEnd: number,
  primerMinLength: number,    // Default: 18
  primerMaxLength: number,    // Default: 25
  tmMin: number,              // Default: 55
  tmMax: number,              // Default: 65
  gcMin: number,              // Default: 40
  gcMax: number,              // Default: 60
  maxSelfComplementarity: number,
  maxPairComplementarity: number,
  productSizeMin: number,
  productSizeMax: number,
  naConcentration: number,    // mM
  numPrimers: number          // Number of pairs to return
}
Response: {
  primerPairs: [{
    forward: {
      sequence: string,
      start: number,
      length: number,
      tm: number,
      gc: number,
      selfDimerDG: number,
      hairpinTm: number
    },
    reverse: { ...same fields... },
    pairDimerDG: number,
    tmDifference: number,
    productSize: number,
    score: number
  }]
}
```

---

## 1.27 Primer Validation

### Algorithm / Logic
```
For a given primer sequence, calculate and report:
1. Length
2. Tm (all three methods)
3. GC content
4. GC clamp (last 2 bases)
5. Nucleotide runs (longest homo-polymer)
6. Self-dimer analysis (ΔG)
7. Hairpin analysis (ΔG, stem Tm)
8. 3' end stability
9. Molecular weight

PASS/FAIL verdict for each criterion
Overall quality score
```

### API Route
```
POST /api/tools/sequence-analysis/primer-validation
Body: { primer: string, naConcentration: number }
Response: {
  length: number,
  tm: { basic: number, salt: number, nearestNeighbor: number },
  gc: number,
  gcClamp: boolean,
  maxRun: number,
  selfDimer: { dg: number, structure: string },
  hairpin: { tm: number, dg: number, structure: string },
  endStability: number,
  mw: number,
  verdict: "PASS" | "WARN" | "FAIL",
  issues: string[]
}
```

---

## 1.28 Primer Specificity Checker

### Algorithm / Logic
```
1. Take primer sequence + template/genome sequence
2. Search for all possible binding sites using Smith-Waterman
   with a specialized scoring:
   - Perfect match at 3' end (seed region, last 8bp) is critical
   - Allow mismatches in 5' region
   - Calculate effective Tm at each binding site
3. Flag potential off-target amplification:
   - Two primers binding within 50-5000 bp on opposite strands
   - With effective Tm > annealing temperature
4. Report: specific vs non-specific binding sites
```

### API Route
```
POST /api/tools/sequence-analysis/primer-specificity
Body: {
  forwardPrimer: string,
  reversePrimer: string,
  template: string,
  maxMismatches: number,
  annealingTemp: number
}
Response: {
  forwardBindingSites: [{ position: number, mismatches: number, effectiveTm: number }],
  reverseBindingSites: [...],
  predictedProducts: [{ size: number, fwdPos: number, revPos: number, specific: boolean }]
}
```

---

## 1.29 PCR Simulator

### Algorithm / Logic
```
1. Find primer binding sites on template (forward and reverse complement)
2. For each valid primer pair (opposite strands, product size < max):
   - Predict amplicon sequence
   - Calculate product size
   - Predict whether amplification will occur:
     - Check Tm > annealing temperature for both primers
     - Check for secondary structure in template at binding sites
3. Simulate gel result:
   - Show expected band sizes
   - Compare with DNA ladder
4. Advanced: model amplification efficiency based on:
   - Primer Tm match
   - GC content of product
   - Secondary structure
```

### API Route
```
POST /api/tools/sequence-analysis/pcr-simulator
Body: {
  template: string,
  forwardPrimer: string,
  reversePrimer: string,
  annealingTemp: number,
  cycles: number,            // For efficiency simulation
  topology: "linear" | "circular"
}
Response: {
  products: [{
    size: number,
    sequence: string,
    fwdBindSite: number,
    revBindSite: number,
    fwdMismatches: number,
    revMismatches: number,
    amplificationPrediction: "strong" | "weak" | "unlikely"
  }],
  gelVisualization: {...}
}
```

---

## 1.30 Mutation Generator

### Algorithm / Logic
```
Types of mutations:
1. Point mutations (SNPs):
   - Transition: purine↔purine (A↔G) or pyrimidine↔pyrimidine (C↔T)
   - Transversion: purine↔pyrimidine (A↔C, A↔T, G↔C, G↔T)
   - Random or at specified positions

2. Insertions:
   - Insert 1-N random nucleotides at specified or random positions

3. Deletions:
   - Delete 1-N nucleotides at specified or random positions

4. For coding sequences:
   - Synonymous: mutate 3rd codon position to encode same amino acid
   - Non-synonymous: mutate to encode different amino acid
   - Nonsense: mutate to create premature stop codon

Parameters:
  - Mutation rate (mutations per base)
  - Transition/transversion ratio (default: 2.0, typical for mammals)
  - Constrain to synonymous/non-synonymous
```

### API Route
```
POST /api/tools/sequence-analysis/mutation-generator
Body: {
  sequence: string,
  mutationType: "point" | "insertion" | "deletion" | "mixed",
  count: number,               // Number of mutations
  positions: number[],         // Specific positions (optional)
  tiTvRatio: number,          // Transition/transversion ratio
  synonymousOnly: boolean,
  seed: number                 // Random seed for reproducibility
}
Response: {
  mutatedSequence: string,
  mutations: [{
    type: string,
    position: number,
    original: string,
    mutated: string,
    effect: string             // "synonymous", "missense", "nonsense"
  }],
  originalVsMutated: string    // Alignment showing changes
}
```

---

## 1.31 SNP Finder

### Algorithm / Logic
```
1. Align two or more sequences (using MSA)
2. At each column, check if there's variation:
   - If exactly 2 alleles present and minor allele frequency > threshold:
     it's a SNP
3. Classify each SNP:
   - Transition vs transversion
   - If in coding region: synonymous, missense, nonsense
   - Position relative to genes (if annotation provided)
4. Calculate:
   - SNP density (SNPs per kb)
   - Transition/transversion ratio
   - Minor allele frequency for each SNP
```

### API Route
```
POST /api/tools/sequence-analysis/snp-finder
Body: {
  sequences: string,           // Multi-FASTA (pre-aligned or will be aligned)
  referenceIndex: number,     // Which sequence is reference (default: 0)
  minAlleleFreq: number,      // Minimum minor allele frequency
  codingRegions: [{ start: number, end: number }]  // Optional CDS annotation
}
Response: {
  snps: [{
    position: number,
    referenceAllele: string,
    alternateAllele: string,
    type: "transition" | "transversion",
    frequency: number,
    effect: string,
    codonChange: string,
    aminoAcidChange: string
  }],
  summary: { total: number, transitions: number, transversions: number, tiTvRatio: number }
}
```

---

## 1.32 Variant Annotation

### Algorithm / Logic
```
1. Parse variant input (VCF format or position + alleles)
2. Map variant to genomic features (requires annotation/GFF):
   - Intergenic, upstream, downstream, 5'UTR, 3'UTR
   - Intronic, splice site (within 2bp of exon boundary)
   - Coding: synonymous, missense, nonsense, frameshift
3. For coding variants:
   - Determine affected codon
   - Translate reference and alternate codons
   - Classify: synonymous, missense (conservative/radical), nonsense
   - Predict impact: HIGH (frameshift, nonsense), MODERATE (missense), 
     LOW (synonymous), MODIFIER (intergenic)
4. Amino acid property changes:
   - Grantham score (biochemical difference between amino acids)
   - BLOSUM62 score for the substitution
```

### API Route
```
POST /api/tools/sequence-analysis/variant-annotation
Body: {
  variants: [{ chrom: string, pos: number, ref: string, alt: string }],
  referenceSequence: string,
  annotation: string,          // GFF/GFF3 format
  geneticCode: number
}
Response: {
  annotatedVariants: [{
    ...inputVariant,
    gene: string,
    feature: string,
    effect: string,
    impact: "HIGH" | "MODERATE" | "LOW" | "MODIFIER",
    codonChange: string,
    aminoAcidChange: string,
    granthamScore: number
  }]
}
```

---

## 1.33 CRISPR Guide RNA Designer

### Algorithm / Logic
```
1. PAM SITE IDENTIFICATION:
   - SpCas9: Find all NGG on both strands (N = any nucleotide)
   - SaCas9: Find all NNGRRT
   - Cas12a/Cpf1: Find all TTTV (PAM is upstream)
   
2. GUIDE SEQUENCE EXTRACTION:
   - SpCas9: 20nt immediately upstream of PAM (5' → 3')
   - Cas12a: 20-24nt downstream of PAM
   
3. ON-TARGET SCORING (Rule Set 2 / Doench 2016):
   - Position-specific nucleotide preferences
   - GC content (ideal: 40-70% for the guide)
   - No poly-T stretches (≥4 T's = Pol III termination signal)
   - Avoid extreme GC at position 15-20 (seed region)
   
4. OFF-TARGET PREDICTION:
   - Search genome for all sites with ≤ 4 mismatches to guide
   - Weight mismatches by position:
     - Seed region (PAM-proximal 12nt): mismatches are less tolerated
     - PAM-distal: mismatches more tolerated
   - CFD score (Cutting Frequency Determination):
     CFD = Π(mismatch_weight[position][mismatch_type])
   - Sum of CFD scores = aggregate off-target score (lower = more specific)
   
5. GUIDE RANKING:
   Combined score = on-target_score × specificity_score
   Higher = better guide
```

### API Route
```
POST /api/tools/sequence-analysis/crispr-designer
Body: {
  targetSequence: string,
  targetStart: number,
  targetEnd: number,
  cas: "SpCas9" | "SaCas9" | "Cas12a",
  guideLength: number,          // Default: 20
  genomeSequence: string,       // For off-target checking
  maxOffTargetMismatches: number // Default: 4
}
Response: {
  guides: [{
    sequence: string,
    pamSequence: string,
    strand: "+" | "-",
    position: number,
    gcContent: number,
    onTargetScore: number,
    offTargets: [{
      position: number,
      mismatches: number,
      mismatchPositions: number[],
      cfdScore: number,
      sequence: string
    }],
    specificityScore: number,
    overallScore: number
  }]
}
```

---

# CATEGORY 2: Sequence Utilities

---

## 2.1 Sequence Cleaner

### Algorithm / Logic
```
Remove Ns:
  - Strip all 'N' characters from sequence
  - Or replace N with random nucleotide (A/T/G/C)
  
Trim Sequence:
  - Remove leading/trailing Ns
  - Quality-based trimming: trim from ends until average quality ≥ threshold
    (for FASTQ input)
  - Trim to specified length from 5' or 3' end

General cleaning:
  - Remove whitespace, numbers, non-sequence characters
  - Convert to uppercase
  - Remove FASTA headers if present
  - Validate remaining characters (ATGCNRYSWKMBDHV for DNA)
```

### API Route
```
POST /api/tools/utilities/sequence-cleaner
Body: {
  sequence: string,
  operations: string[],    // ["removeNs", "trim", "uppercase", "removeNumbers", ...]
  trimLength: number,      // Optional
  trimEnd: "5prime" | "3prime" | "both",
  replaceNs: "remove" | "random" | "keep"
}
```

---

## 2.2 Sequence Validator

### Algorithm / Logic
```
1. Detect sequence type:
   - DNA: only A, T, G, C, N (+ IUPAC ambiguity codes)
   - RNA: only A, U, G, C, N
   - Protein: 20 standard amino acids + *BXZ

2. Validation checks:
   - All characters are valid for the detected type
   - No mixing of DNA and RNA (T and U in same sequence)
   - Length check (reasonable ranges)
   - For coding sequences: length divisible by 3
   - For FASTA: proper header format (starts with >)
   
3. Report:
   - Detected type
   - Length
   - Composition
   - Any invalid characters and their positions
   - Warnings (e.g., high N content)
```

### API Route
```
POST /api/tools/utilities/sequence-validator
Body: { sequence: string, expectedType: "dna" | "rna" | "protein" | "auto" }
Response: {
  valid: boolean,
  detectedType: string,
  length: number,
  composition: { [char: string]: number },
  invalidChars: [{ char: string, position: number }],
  warnings: string[]
}
```

---

## 2.3 Format Converters (FASTA↔CSV, GenBank→FASTA, etc.)

### Algorithm / Logic

**FASTA Parser:**
```
Lines starting with '>' = header (ID + description)
Subsequent lines until next '>' = sequence (concatenate, remove whitespace)
```

**GenBank Parser:**
```
LOCUS line: ID, length, type, topology, date
DEFINITION: description
FEATURES section: gene, CDS, mRNA annotations with locations
  Location formats: simple (100..200), complement(100..200), 
  join(100..200,300..400)
ORIGIN section: the actual sequence (with position numbers)
// = end of record
```

**EMBL Parser:**
```
Similar to GenBank but different field identifiers:
ID, AC, DE, FT (features), SQ (sequence)
```

**FASTQ Parser:**
```
Line 1: @header
Line 2: sequence
Line 3: + (optional header)
Line 4: quality scores (ASCII-33 = Phred score)
Quality: Q = -10 × log10(error_probability)
```

**VCF Parser:**
```
Header lines start with ##
Column header: #CHROM POS ID REF ALT QUAL FILTER INFO FORMAT sample1...
Data lines: tab-separated values
Parse INFO field key=value pairs
Parse FORMAT field and sample genotypes
```

**GFF/GFF3 Parser:**
```
Tab-separated: seqid, source, type, start, end, score, strand, phase, attributes
Attributes: ID=...; Name=...; Parent=...
```

**BED Parser:**
```
Tab-separated: chrom, chromStart, chromEnd, name, score, strand, ...
Note: BED is 0-based, half-open intervals
```

**SAM Parser:**
```
Header: @HD, @SQ, @RG, @PG lines
Alignments: QNAME FLAG RNAME POS MAPQ CIGAR RNEXT PNEXT TLEN SEQ QUAL
CIGAR operations: M(match), I(insert), D(delete), N(skip), S(soft-clip), H(hard-clip)
FLAG bits: 0x1=paired, 0x4=unmapped, 0x10=reverse, 0x100=secondary, etc.
```

### API Routes
```
POST /api/tools/utilities/convert
Body: {
  input: string,
  inputFormat: "fasta" | "fastq" | "genbank" | "embl" | "csv" | "vcf" | "gff" | "bed" | "sam",
  outputFormat: "fasta" | "csv" | "json" | "table",
  options: {
    includeQuality: boolean,     // FASTQ
    extractCDS: boolean,         // GenBank: extract coding sequences
    translateCDS: boolean        // GenBank: translate CDS to protein
  }
}
Response: {
  output: string,
  recordCount: number,
  warnings: string[]
}
```

### Implementation Prompt
```
Implement robust parsers for all standard bioinformatics file formats:

1. FASTA: Handle multi-line sequences, multiple records, comment lines (;)
2. FASTQ: Parse quality scores, calculate average quality, support Phred+33/+64
3. GenBank: Full feature table parsing with complement/join locations, extract 
   sequences by feature type, translate CDS features
4. EMBL: Similar to GenBank with EMBL field identifiers
5. VCF: Parse header metadata (##INFO, ##FORMAT), genotype fields, calculate allele 
   frequencies
6. GFF3: Parse hierarchical features (gene→mRNA→exon), reconstruct transcript sequences
7. BED: Handle BED3 through BED12 (including blockStarts/blockSizes for exons)
8. SAM: Parse CIGAR strings, reconstruct aligned sequences, calculate mapping statistics

Each parser must:
- Handle malformed input gracefully with specific error messages
- Support streaming for large files (process line by line)
- Validate format-specific constraints
- Convert between formats preserving all possible information
```

---

# CATEGORY 3: Genomics (NGS Tools)

> These are re-implementations of essential NGS pipeline tools for educational/lightweight use.

---

## 3.1 Read Alignment (BWA/Bowtie2/HISAT2/STAR/Minimap2)

### Biological Purpose
Align sequencing reads to a reference genome. This is the foundation of all NGS analyses.

### Algorithm / Logic

**BWT-based alignment (BWA-like):**
```
1. INDEX BUILDING (Burrows-Wheeler Transform):
   a. Append '$' to reference genome
   b. Generate all rotations of the string
   c. Sort rotations lexicographically
   d. BWT = last column of sorted rotation matrix
   e. Build FM-index: 
      - Occurrence table (Occ): count of each character up to position i
      - C array: cumulative count of characters lexicographically smaller
   
   Backward search:
   For pattern P of length m:
     sp = C[P[m-1]] + 1
     ep = C[P[m-1] + 1]
     for i = m-2 down to 0:
       sp = C[P[i]] + Occ(P[i], sp - 1) + 1
       ep = C[P[i]] + Occ(P[i], ep)
     if sp <= ep: pattern found at positions derived from suffix array

2. SEED-AND-EXTEND:
   - Find exact matches of seeds (subsequences of the read)
   - Seeds of length ~20bp, spaced across the read
   - Extend seeds using Smith-Waterman for gapped alignment
   - Allow mismatches and short indels

3. MAPPING QUALITY:
   MAPQ = -10 × log10(probability of incorrect mapping)
   Based on: number of equally good mappings, alignment score difference
```

**Minimap2-like (for long reads):**
```
1. Index reference using minimizers:
   - For each window of w consecutive k-mers, keep the smallest (minimizer)
   - Hash minimizer → position
2. Find seed hits (shared minimizers between read and reference)
3. Chain seeds using dynamic programming:
   - Score = Σ(seed lengths) - gap penalties between seeds
4. Perform base-level alignment using KSW2 (banded Smith-Waterman)
```

### API Route
```
POST /api/tools/genomics/align
Body: {
  reference: string,           // FASTA reference genome
  reads: string,               // FASTQ reads
  algorithm: "bwa" | "bowtie2" | "minimap2",
  pairedEnd: boolean,
  reads2: string,              // Mate pairs (if paired)
  maxMismatches: number,
  minMappingQuality: number
}
Response: {
  alignments: string,          // SAM format output
  stats: {
    totalReads: number,
    mappedReads: number,
    unmappedReads: number,
    mappingRate: number,
    averageMapq: number
  }
}
```

### Implementation Prompt
```
Implement a simplified BWT-based read aligner:
1. Build BWT and FM-index of the reference sequence
2. Implement backward search for exact matching
3. For inexact matching: use seed-and-extend approach
   - Extract seeds of 11bp from the read at positions 0, 11, 22, ...
   - Find exact matches for each seed using FM-index
   - Extend each seed match using banded Smith-Waterman
4. Calculate MAPQ based on number of equally good mapping positions
5. Output in SAM format with proper CIGAR strings
6. For the web tool: limit reference size to ~10MB and read count to ~10000
   for browser performance
```

---

## 3.2 Variant Calling (GATK-like)

### Algorithm / Logic
```
Simplified variant calling pipeline:

1. PILEUP:
   - For each position in the reference, stack all reads covering that position
   - Count bases at each position (A, C, G, T counts)
   
2. GENOTYPING (Bayesian approach):
   For each position with coverage ≥ min_depth:
   
   Prior probabilities:
     P(genotype) for all possible genotypes (AA, AC, AG, AT, CC, CG, CT, GG, GT, TT)
     Assume HWE: P(het) = 2pq, P(hom_ref) = p², P(hom_alt) = q²
   
   Likelihood:
     P(data | genotype) = Π P(base_i | genotype)
     Where P(base_i | genotype) accounts for base quality:
       If base matches genotype: P = 1 - 10^(-Q/10)
       If base doesn't match: P = 10^(-Q/10) / 3
   
   Posterior (Bayes):
     P(genotype | data) ∝ P(data | genotype) × P(genotype)
   
   Call variant if:
     Best genotype ≠ reference homozygous AND
     QUAL = -10 × log10(P(ref/ref | data)) > threshold

3. FILTERING:
   - Minimum depth (DP ≥ 10)
   - Minimum quality (QUAL ≥ 20)
   - Strand bias (Fisher's exact test on ref/alt counts per strand)
   - Mapping quality (average MAPQ ≥ 20)
   - Base quality rank sum test
```

### API Route
```
POST /api/tools/genomics/variant-calling
Body: {
  reference: string,
  alignments: string,          // SAM format
  minDepth: number,
  minQuality: number,
  ploidy: number               // Default: 2
}
Response: {
  variants: string,            // VCF format
  stats: {
    totalPositions: number,
    variantsCalled: number,
    snps: number,
    indels: number,
    tiTvRatio: number,
    hetHomRatio: number
  }
}
```

---

## 3.3 SAMtools / BCFtools / BEDTools (Utilities)

### Algorithm / Logic
```
SAMtools operations:
  - sort: Sort SAM by position (comparison sort on RNAME + POS)
  - index: Build BAI index (intervals → file offset)
  - flagstat: Count reads by FLAG category
  - depth: Calculate per-position depth from CIGAR strings
  - view: Filter reads by flag, quality, region

BCFtools operations:
  - stats: VCF statistics (ts/tv ratio, SNP count, indel count)
  - filter: Apply expression-based filters
  - merge: Merge multiple VCF files
  - isec: Intersection of VCF files

BEDTools operations:
  - intersect: Find overlapping intervals between two BED files
    Algorithm: Sort both files, use sweep line
  - merge: Merge overlapping intervals
    Sort by start → merge if next.start ≤ current.end
  - subtract: Remove regions in B from A
  - complement: Find gaps between intervals
  - coverage: Calculate coverage of A over B
  - closest: Find nearest feature
```

### API Routes
```
POST /api/tools/genomics/samtools
Body: { operation: "sort"|"flagstat"|"depth"|"view"|"idxstats", input: string, options: {} }

POST /api/tools/genomics/bcftools
Body: { operation: "stats"|"filter"|"merge"|"isec", input: string, options: {} }

POST /api/tools/genomics/bedtools
Body: { operation: "intersect"|"merge"|"subtract"|"complement"|"closest"|"coverage",
        inputA: string, inputB: string, options: {} }
```

---

## 3.4 Coverage & Read Depth Calculator

### Algorithm / Logic
```
1. Parse SAM/BAM alignments
2. For each alignment, decode CIGAR string to determine which reference
   positions are covered:
   M/=/X: reference position covered
   I: insertion (no ref position consumed)
   D/N: reference position consumed but no read base
3. Accumulate depth at each position
4. Calculate:
   - Mean depth
   - Median depth
   - Min/max depth
   - Breadth of coverage (% of reference with depth ≥ 1)
   - Depth histogram
   - Depth uniformity (coefficient of variation)
   - Per-base depth profile
```

### API Route
```
POST /api/tools/genomics/coverage
Body: { alignments: string, reference: string, region: string }
Response: {
  meanDepth: number,
  medianDepth: number,
  breadthOfCoverage: number,
  depthProfile: number[],
  histogram: { [depth: string]: number }
}
```

---

## 3.5 Variant Filter

### Algorithm / Logic
```
Apply filters to VCF variants:
1. Quality filters: QUAL ≥ threshold
2. Depth filters: DP ≥ min, DP ≤ max
3. Allele frequency: AF ≥ min, AF ≤ max
4. Strand bias: Fisher's exact p-value > threshold
5. Mapping quality: MQ ≥ threshold
6. Read position: variant not only at read ends
7. Custom expressions: parse and evaluate filter expressions on INFO fields

Mark filtered variants as PASS or with filter name (don't remove them)
```

### API Route
```
POST /api/tools/genomics/variant-filter
Body: {
  vcf: string,
  filters: {
    minQual: number,
    minDepth: number,
    maxDepth: number,
    minAF: number,
    maxAF: number,
    minMQ: number,
    maxStrandBias: number
  }
}
```

---

## 3.6 CNV Detection

### Algorithm / Logic
```
Read-depth based CNV detection:
1. Divide genome into windows (bins) of fixed size (e.g., 1kb)
2. Count reads per bin
3. Normalize by:
   - Total reads (RPKM)
   - GC content (GC bias correction using LOESS regression)
4. Log2 ratio: log2(sample_count / expected_count)
5. Segmentation (Circular Binary Segmentation):
   - Find breakpoints where copy number changes
   - Statistical test for difference in means across breakpoint
6. Classify segments:
   - Deletion: log2 ratio < -0.5
   - Duplication: log2 ratio > 0.3
   - Normal: between -0.3 and 0.3
```

---

## 3.7 RNA-Seq Analysis / Differential Expression

### Algorithm / Logic
```
1. COUNT MATRIX:
   - From aligned reads + gene annotation (GFF):
   - Count reads overlapping each gene/exon
   - Use feature assignment rules: union, intersection-strict, etc.

2. NORMALIZATION (DESeq2-like):
   Size factors method:
     a. For each gene, calculate geometric mean across all samples
     b. For each sample: size_factor = median(count / geometric_mean) for all genes
     c. Normalized count = raw_count / size_factor

3. DIFFERENTIAL EXPRESSION (DESeq2 model):
   Model: K_ij ~ NB(μ_ij, α_i)
   Where:
     K = count for gene i in sample j
     NB = Negative Binomial distribution
     μ = mean (estimated from normalized counts)
     α = dispersion parameter
   
   Dispersion estimation:
     a. Gene-wise dispersion (MLE)
     b. Fit dispersion-mean trend
     c. Shrink gene-wise toward trend (empirical Bayes)
   
   Testing (Wald test):
     β = log2 fold change coefficient
     SE = standard error of β
     Statistic = β / SE ~ Normal(0,1)
     p-value from two-sided test
     Adjusted p-value: Benjamini-Hochberg FDR correction

4. OUTPUT:
   - Gene, baseMean, log2FoldChange, lfcSE, stat, pvalue, padj
   - Volcano plot data
   - MA plot data
```

### API Route
```
POST /api/tools/genomics/deseq
Body: {
  countMatrix: number[][],      // genes × samples
  geneNames: string[],
  sampleNames: string[],
  conditions: string[],        // e.g., ["control", "control", "treated", "treated"]
  alpha: number                // FDR threshold (default: 0.05)
}
Response: {
  results: [{
    gene: string,
    baseMean: number,
    log2FoldChange: number,
    lfcSE: number,
    stat: number,
    pvalue: number,
    padj: number,
    significant: boolean
  }],
  volcanoData: { x: number[], y: number[], labels: string[] },
  maData: { a: number[], m: number[], labels: string[] }
}
```

### Implementation Prompt
```
Implement a simplified DESeq2-like differential expression analysis:

1. Input: count matrix (genes × samples) + condition labels
2. Size factor normalization: for each sample, calculate size factor as the 
   median ratio of counts to geometric mean of counts across samples
3. Dispersion estimation:
   a. For each gene, estimate dispersion using method of moments:
      α = (variance - mean) / mean²
   b. Fit a dispersion-mean trend using local regression
   c. Shrink gene dispersions toward the trend
4. Negative Binomial GLM fitting using IRLS (Iteratively Reweighted Least Squares)
5. Wald test for significance of condition coefficient
6. BH p-value adjustment for multiple testing
7. Generate volcano plot data (-log10(padj) vs log2FC) and MA plot data
```

---

## 3.8 Heatmap / Volcano / PCA Plot Data

### Algorithm / Logic
```
HEATMAP:
  - Input: expression matrix (genes × samples)
  - Z-score normalize each gene: z = (x - mean) / stdev
  - Hierarchical clustering of rows and columns:
    Distance: Euclidean or 1 - Pearson correlation
    Linkage: complete, average, or Ward's
  - Output: clustered matrix + dendrograms

VOLCANO PLOT:
  - x-axis: log2(fold change)
  - y-axis: -log10(adjusted p-value)
  - Thresholds: |log2FC| > 1 AND padj < 0.05 → significant
  - Color: red (up), blue (down), gray (not significant)

PCA PLOT:
  1. Center the data (subtract mean of each gene)
  2. Calculate covariance matrix (genes × genes)
  3. Eigendecomposition: get eigenvalues and eigenvectors
  4. Project samples onto top 2-3 eigenvectors (principal components)
  5. Variance explained = eigenvalue / sum(all eigenvalues)
  6. Plot: PC1 vs PC2, colored by condition
  
  Simplified implementation:
  - Use power iteration or SVD to find top components
  - SVD: X = UΣVᵀ; principal components = columns of U × Σ
```

### API Route
```
POST /api/tools/genomics/visualization
Body: {
  type: "heatmap" | "volcano" | "pca",
  matrix: number[][],
  geneNames: string[],
  sampleNames: string[],
  conditions: string[],
  // For volcano: log2FC and padj arrays
  // For heatmap: clustering options
}
```

---

## 3.9 SnpEff / VEP (Variant Effect Prediction)

### Algorithm / Logic
```
1. Parse variant (chromosome, position, ref, alt)
2. Determine genomic context from gene annotation:
   - Map variant position to gene, transcript, exon
3. Predict effect:
   a. Coding region:
      - Determine affected codon
      - Translate reference and alternate codons
      - Classify: synonymous, missense, nonsense, frameshift
   b. Splice site: within 2bp of exon boundary → splice_donor/acceptor
   c. Intron: intronic variant
   d. UTR: 5' or 3' UTR variant
   e. Intergenic: upstream/downstream of nearest gene
4. Impact classification:
   HIGH: frameshift, nonsense, splice site
   MODERATE: missense
   LOW: synonymous, splice_region
   MODIFIER: intronic, intergenic, UTR
5. Additional annotations:
   - Amino acid change (e.g., p.R100W)
   - HGVS notation (c.298C>T)
   - Affected protein domain (if available)
```

---

## 3.10 Kraken2 / MetaPhlAn (Taxonomic Classification)

### Algorithm / Logic
```
Kraken2-like:
1. Build database: hash k-mers (k=31) from reference genomes
   Each k-mer → LCA (Lowest Common Ancestor) taxonomy
2. For each read:
   - Extract all k-mers
   - Look up each k-mer's taxonomic assignment
   - Map assignments to taxonomy tree
   - Use classification tree algorithm:
     Walk from leaf to root, accumulate k-mer counts
     Classify read at the node with highest path score
3. Report: taxonomy → read count → relative abundance

MetaPhlAn-like:
1. Use clade-specific marker genes instead of all k-mers
2. Map reads to marker gene database
3. Abundance = (reads hitting markers for taxon) / (total marker gene length for taxon)
   Normalized to sum to 100%
```

---

# CATEGORY 4: Phylogenetics

---

## 4.1 Neighbor Joining (NJ)

### Algorithm / Logic
```
Input: N × N distance matrix D

1. Calculate r_i = Σ D(i,k) for all k (row sums)

2. Create matrix M:
   M(i,j) = (N-2) × D(i,j) - r_i - r_j

3. Find minimum M(i,j) → join taxa i and j as node u

4. Branch lengths:
   d(i,u) = D(i,j)/2 + (r_i - r_j) / (2(N-2))
   d(j,u) = D(i,j) - d(i,u)

5. Update distance matrix:
   D(u,k) = (D(i,k) + D(j,k) - D(i,j)) / 2

6. Remove i and j, add u; N = N-1

7. Repeat until N = 2

Output: unrooted tree in Newick format
Time: O(N³)
```

### API Route
```
POST /api/tools/phylogenetics/neighbor-joining
Body: {
  input: string,                // Aligned FASTA sequences
  distanceModel: "jc69" | "k2p" | "tamura-nei" | "p-distance",
  sequenceType: "dna" | "protein"
}
Response: {
  tree: string,                 // Newick format
  distanceMatrix: number[][],
  labels: string[]
}
```

---

## 4.2 UPGMA

### Algorithm / Logic
```
Unweighted Pair Group Method with Arithmetic Mean

Input: N × N distance matrix

1. Each sequence starts as its own cluster
2. Find the two closest clusters i, j with smallest D(i,j)
3. Create new cluster u with height = D(i,j) / 2
4. Update distances (average linkage):
   D(u,k) = (|i| × D(i,k) + |j| × D(j,k)) / (|i| + |j|)
   Where |i| = number of sequences in cluster i
5. Remove i, j; add u
6. Repeat until one cluster remains

Key difference from NJ: 
  - UPGMA assumes a molecular clock (ultrametric tree)
  - All leaves are equidistant from root
  - UPGMA can be inaccurate when evolution rates vary
```

### API Route
```
POST /api/tools/phylogenetics/upgma
Body: { input: string, distanceModel: string }
Response: { tree: string, distanceMatrix: number[][] }
```

---

## 4.3 Maximum Likelihood

### Algorithm / Logic
```
Find the tree that maximizes P(data | tree, model)

1. SUBSTITUTION MODELS:
   JC69: All substitutions equally likely; 1 parameter (μ)
   K2P: Transitions ≠ transversions; 2 parameters (α, β)
   HKY: K2P + unequal base frequencies; 5 parameters
   GTR: General Time Reversible; 9 parameters (6 rates + 4 frequencies - 1)

2. LIKELIHOOD CALCULATION (Felsenstein pruning / post-order traversal):
   For each site (column in alignment):
     At each leaf: L(leaf, base) = 1 if base observed, 0 otherwise
     
     At internal node u with children v, w:
       L(u, x) = [Σ_y P(y|x,t_v) × L(v,y)] × [Σ_z P(z|x,t_w) × L(w,z)]
       
     Where P(y|x,t) = transition probability matrix:
       P(t) = e^(Qt) (matrix exponential of rate matrix Q × time t)
     
     For JC69: P(same|t) = 1/4 + 3/4 × e^(-4μt/3)
               P(diff|t) = 1/4 - 1/4 × e^(-4μt/3)
     
   Total log-likelihood = Σ_sites ln(Σ_x π_x × L(root, x))
   Where π_x = equilibrium frequency of base x

3. TREE SEARCH:
   - Start with NJ tree (good starting topology)
   - Apply tree rearrangements:
     NNI (Nearest Neighbor Interchange): swap 2 of 4 subtrees at each internal edge
     SPR (Subtree Pruning and Regrafting): remove subtree, reattach elsewhere
   - For each topology, optimize branch lengths (Newton-Raphson or Brent's method)
   - Keep topology with highest likelihood
   - Stop when no rearrangement improves likelihood

4. Simplified version for web:
   - Fix topology from NJ
   - Optimize branch lengths only
   - Report likelihood under JC69 and K2P models
```

### API Route
```
POST /api/tools/phylogenetics/maximum-likelihood
Body: {
  alignment: string,
  model: "JC69" | "K2P" | "HKY" | "GTR",
  startTree: "nj" | "upgma" | string,  // Newick for custom start
  searchStrategy: "nni" | "spr" | "none",
  sequenceType: "dna" | "protein"
}
Response: {
  tree: string,
  logLikelihood: number,
  modelParams: {
    baseFrequencies: number[],
    substitutionRates: number[],
    gamma: number
  },
  branchLengths: { [branch: string]: number }
}
```

---

## 4.4 Maximum Parsimony

### Algorithm / Logic
```
Find the tree requiring the fewest evolutionary changes (mutations).

1. PARSIMONY SCORE (Fitch algorithm):
   For each site:
     At each leaf: set = {observed_base}
     At each internal node (post-order):
       if left_set ∩ right_set ≠ ∅:
         node_set = left_set ∩ right_set  (no extra change needed)
       else:
         node_set = left_set ∪ right_set  (1 change needed, score += 1)
   
   Total parsimony score = Σ over all sites

2. TREE SEARCH:
   - Enumerate trees (for ≤ 10 taxa: exhaustive; > 10: heuristic NNI/SPR)
   - For each tree: calculate parsimony score
   - Return tree with minimum score
```

### API Route
```
POST /api/tools/phylogenetics/maximum-parsimony
Body: { alignment: string }
Response: { tree: string, parsimonyScore: number, consistencyIndex: number }
```

---

## 4.5 Bootstrap Analysis

### Algorithm / Logic
```
1. Original alignment: N sequences × M sites
2. For each bootstrap replicate (typically 100-1000):
   a. Resample M sites WITH REPLACEMENT from the original alignment
      (some sites will be sampled multiple times, some not at all)
   b. Build tree from resampled alignment (using NJ, ML, or MP)
3. For each bipartition (split) in the original tree:
   - Count how many bootstrap trees contain the same split
   - Bootstrap support = count / total_replicates × 100%
4. Map bootstrap values to original tree branches
5. Interpretation: ≥70% = moderate support, ≥95% = strong support
```

### API Route
```
POST /api/tools/phylogenetics/bootstrap
Body: {
  alignment: string,
  method: "nj" | "ml" | "mp",
  replicates: number,         // Default: 100
  model: string               // For ML
}
Response: {
  tree: string,               // Original tree with bootstrap values
  bootstrapValues: { [branch: string]: number },
  consensusTree: string       // Majority-rule consensus
}
```

---

## 4.6 Tree Viewer / Editor / Annotation

### Algorithm / Logic
```
Tree rendering:
1. Parse Newick format → tree data structure
   Grammar: tree = leaf | (subtree,subtree):distance
   Leaf = name:distance
   
2. Layout algorithms:
   Rectangular (Phylogram):
     - x = branch length (cumulative from root)
     - y = evenly spaced leaves, internal nodes at mean of children
   
   Circular (Radial):
     - Angle = proportional to number of leaves in subtree
     - Radius = branch length
     
   Cladogram:
     - All leaves at same x
     - Branches show topology only (not lengths)

3. Rendering with SVG/Canvas:
   - Draw branches (lines/arcs)
   - Label leaves
   - Show bootstrap values
   - Color by metadata
   
4. Interactive features:
   - Zoom/pan
   - Collapse/expand subtrees
   - Reroot at any node
   - Swap children
   - Add annotations (labels, colors, symbols)
```

### API Route
```
POST /api/tools/phylogenetics/tree-render
Body: {
  newick: string,
  layout: "rectangular" | "circular" | "unrooted" | "cladogram",
  showBranchLengths: boolean,
  showBootstrap: boolean,
  annotations: { [leaf: string]: { color: string, label: string } },
  rootAt: string              // Outgroup name for rooting
}
Response: {
  svg: string,                // SVG rendering
  treeData: object            // JSON tree structure for interactive viewer
}
```

---

# CATEGORY 5: Protein Analysis

---

## 5.1 Domain Finder / Motif Finder

### Algorithm / Logic
```
Domain finding (simplified InterProScan):
1. Build profiles from known domain families (HMMs or PSSMs)
2. Scan query protein against domain database using:
   - Profile HMM matching (simplified Viterbi algorithm)
   - Or PSSM scoring (position-specific scoring)
3. Report domain hits above significance threshold

Motif finding:
1. Known motifs: search using PROSITE patterns
   Pattern syntax: [AC]-x-V-x(4)-{ED} 
   [AC] = A or C; x = any; V = valine; x(4) = any 4 residues; {ED} = not E or D
   Convert to regex and search

2. De novo motif discovery (simplified MEME):
   - Expectation-Maximization algorithm
   - Start: random or substring initialization
   - E-step: calculate probability each subsequence is a motif instance
   - M-step: update position weight matrix from weighted counts
   - Repeat until convergence
```

---

## 5.2 Signal Peptide / Transmembrane / Subcellular Localization Prediction

### Algorithm / Logic
```
SIGNAL PEPTIDE (simplified SignalP):
1. Features of signal peptides:
   - N-region (1-5 residues): positive charges (K, R)
   - H-region (7-15 residues): hydrophobic (A, V, L, I, F, W)
   - C-region (3-7 residues): small neutral (A, G, S) at -1 and -3 (von Heijne rule)
2. Sliding window hydrophobicity score
3. Check for von Heijne cleavage site motif: [^DEKRHP][^DEKRHP]↓[^P]
4. Score = hydrophobicity_score + cleavage_site_score + charge_score

TRANSMEMBRANE (simplified TMHMM):
1. Hydrophobicity plot using Kyte-Doolittle scale:
   I:4.5, V:4.2, L:3.8, F:2.8, C:2.5, M:1.9, A:1.8, G:-0.4,
   T:-0.7, S:-0.8, W:-0.9, Y:-1.3, P:-1.6, H:-3.2, E:-3.5,
   D:-3.5, N:-3.5, Q:-3.5, K:-3.9, R:-4.5
2. Sliding window average (window=19-21)
3. Regions with average > 1.6 for ≥ 20 residues → transmembrane helix
4. Determine topology: in/out based on positive-inside rule
   (more K+R on cytoplasmic side)

SUBCELLULAR LOCALIZATION:
1. Check for known targeting signals:
   - Signal peptide → secreted/ER
   - Nuclear localization signal (NLS): PKKKRKV or similar
   - Mitochondrial targeting peptide: amphipathic helix, R-rich
   - Peroxisomal targeting: SKL at C-terminus (PTS1)
2. Amino acid composition analysis (some compartments have distinct compositions)
```

---

## 5.3 Secondary Structure Prediction

### Algorithm / Logic
```
GOR method (simplified):
1. For each position, calculate propensities:
   P(H|R_j) = probability of helix given residue R at position j
   P(E|R_j) = probability of strand
   P(C|R_j) = probability of coil
   
   Chou-Fasman propensities:
   Strong helix formers: E(1.53), A(1.45), L(1.34), M(1.20), Q(1.17), K(1.07), R(1.00), H(1.00)
   Strong strand formers: V(1.65), I(1.60), Y(1.29), F(1.28), W(1.19), L(1.22), T(1.20)
   
2. Nucleation rules:
   α-helix: window of 6 residues with ≥ 4 helix formers → nucleate helix
   β-strand: window of 5 residues with ≥ 3 strand formers → nucleate strand
   
3. Extension:
   Extend helix/strand in both directions while average propensity > 1.0
   
4. Decision:
   If regions overlap: assign to type with higher average propensity
```

### API Route
```
POST /api/tools/protein/secondary-structure
Body: { sequence: string }
Response: {
  prediction: string,          // H = helix, E = strand, C = coil
  confidence: number[],
  helixCount: number,
  strandCount: number,
  coilPercent: number
}
```

---

## 5.4 Hydrophobicity Plot

### Algorithm / Logic
```
1. Assign hydrophobicity value to each residue (Kyte-Doolittle scale)
2. Sliding window average (default window = 9 for surface regions, 19 for TM helices)
3. Plot: x = residue position, y = average hydrophobicity
4. Reference lines at 0 (neutral) and 1.6 (TM threshold)
```

---

## 5.5 Isoelectric Point (pI)

### Algorithm / Logic
```
1. For each amino acid, assign pKa values:
   N-terminus: 9.69    C-terminus: 2.34
   D: 3.65  E: 4.25  C: 8.18  Y: 10.07  H: 6.00  K: 10.53  R: 12.48
   
2. Net charge at pH:
   charge = Σ(positively charged: N/(1 + 10^(pH - pKa)))
           - Σ(negatively charged: N/(1 + 10^(pKa - pH)))
   
   Positive: N-term, K, R, H
   Negative: C-term, D, E, C, Y

3. Binary search for pH where net charge ≈ 0:
   low = 0, high = 14
   while (high - low > 0.01):
     mid = (low + high) / 2
     if charge(mid) > 0: low = mid
     else: high = mid
   pI = mid
```

### API Route
```
POST /api/tools/protein/isoelectric-point
Body: { sequence: string }
Response: {
  pI: number,
  chargeAtPH7: number,
  chargeCurve: { ph: number[], charge: number[] }
}
```

---

## 5.6 Amino Acid Composition

### Algorithm / Logic
```
1. Count each of 20 standard amino acids
2. Calculate percentages
3. Group by properties:
   - Hydrophobic: A, V, I, L, M, F, W, P
   - Polar: S, T, N, Q, Y, C
   - Positive: K, R, H
   - Negative: D, E
   - Aromatic: F, W, Y, H
   - Tiny: G, A, S
   - Small: G, A, S, T, V, D, N, C, P
4. Compare to expected composition (Swiss-Prot average)
```

---

## 5.7 Protein Stability / Disulfide Bond Prediction

### Algorithm / Logic
```
PROTEIN STABILITY (Grand Average of Hydropathicity - GRAVY):
  GRAVY = Σ(hydropathy values) / N

Instability Index (Guruprasad):
  II = (10/L) × Σ DIWV[R_i][R_{i+1}]
  Where DIWV = dipeptide instability weight values (400 values)
  II < 40 → stable; II ≥ 40 → unstable

Aliphatic Index:
  AI = X(A) + 2.9 × X(V) + 3.9 × [X(I) + X(L)]
  Where X = mole percent. Higher AI → more thermostable.

DISULFIDE BOND PREDICTION:
1. Find all cysteine positions
2. For each pair of cysteines:
   - Check sequence separation (≥ 3 residues)
   - Calculate coupling energy from flanking amino acids
   - Use position-specific scoring (cysteines in loops more likely to bond)
3. Rank pairs by score, find non-overlapping set with maximum total score
```

---

# CATEGORY 6: Protein Structure

---

## 6.1 3D Structure Viewer (Mol* / JSmol)

### Implementation Notes
```
Use Mol* (Molstar) JavaScript library:
  - npm install molstar
  - Embed Mol* viewer in a React component
  - Load PDB/mmCIF files
  - Support representations: cartoon, ball-and-stick, surface, ribbon
  - Color by: chain, secondary structure, B-factor, hydrophobicity
  - Interactive: click to highlight residues, measure distances/angles

Alternative: JSmol (JavaScript port of Jmol):
  - Load PDB format
  - Basic visualization commands
```

### API Route
```
POST /api/tools/structure/parse-pdb
Body: { pdbContent: string }
Response: {
  atoms: [{ serial, name, resName, chainId, resSeq, x, y, z, occupancy, bFactor }],
  chains: string[],
  residueCount: number,
  secondaryStructure: [{ type, start, end, chain }]
}
```

---

## 6.2 RMSD Calculator

### Algorithm / Logic
```
Root Mean Square Deviation between two structures:

1. Extract matching atom coordinates (typically Cα atoms only)
   Structure 1: {(x1_i, y1_i, z1_i)} for i = 1..N
   Structure 2: {(x2_i, y2_i, z2_i)} for i = 1..N

2. Superimposition (Kabsch algorithm):
   a. Center both structures: subtract centroid from all coordinates
   b. Calculate cross-covariance matrix: H = P1ᵀ × P2
   c. SVD: H = UΣVᵀ
   d. Rotation matrix: R = V × diag(1, 1, det(VUᵀ)) × Uᵀ
   e. Apply rotation to structure 2: P2_aligned = R × P2

3. RMSD = sqrt(Σ ||p1_i - p2_aligned_i||² / N)

Where ||...|| is Euclidean distance
```

### API Route
```
POST /api/tools/structure/rmsd
Body: { structure1: string, structure2: string, atomType: "CA" | "backbone" | "all" }
Response: { rmsd: number, alignedAtoms: number, rotationMatrix: number[][], translation: number[] }
```

---

## 6.3 Ramachandran Plot

### Algorithm / Logic
```
1. For each residue in the protein:
   Calculate backbone dihedral angles:
   
   Phi (φ): C(i-1) - N(i) - Cα(i) - C(i)
   Psi (ψ): N(i) - Cα(i) - C(i) - N(i+1)
   
   Dihedral angle calculation:
   Given 4 atoms A-B-C-D:
     b1 = B - A
     b2 = C - B
     b3 = D - C
     n1 = b1 × b2
     n2 = b2 × b3
     angle = atan2(|b2| × b1 · n2, n1 · n2)

2. Plot φ (x-axis) vs ψ (y-axis) for all residues
3. Overlay allowed regions:
   - Favored regions (core): ~90% of residues
     Right-handed α-helix: φ ≈ -57°, ψ ≈ -47°
     β-sheet: φ ≈ -120°, ψ ≈ +130°
     Left-handed α-helix: φ ≈ +57°, ψ ≈ +47° (rare, only Gly)
   - Allowed regions: ~8%
   - Outlier regions: ~2% (may indicate errors)
4. Special handling for Glycine (more flexible) and Proline (restricted)
```

### API Route
```
POST /api/tools/structure/ramachandran
Body: { pdbContent: string }
Response: {
  residues: [{
    residue: string,
    resNum: number,
    chain: string,
    phi: number,
    psi: number,
    region: "favored" | "allowed" | "outlier"
  }],
  summary: { favored: number, allowed: number, outlier: number }
}
```

---

## 6.4 Surface Area / Electrostatic Surface

### Algorithm / Logic
```
SOLVENT ACCESSIBLE SURFACE AREA (SASA):
Lee-Richards rolling probe method:
1. For each atom: radius = van der Waals radius + probe radius (1.4 Å for water)
2. Slice the molecule with parallel planes (z-planes, spacing = 0.1 Å)
3. For each atom, compute the arc exposed on each slice:
   - Find all neighboring atoms that intersect this slice
   - Calculate the exposed (not buried) arc length
4. SASA = Σ(exposed arc lengths × slice thickness)

Alternatively, Shrake-Rupley method:
1. Distribute N points evenly on each atom's expanded sphere
2. Count points not inside any other atom's expanded sphere
3. SASA = (accessible_points / total_points) × 4π(r + probe)²

ELECTROSTATIC SURFACE (simplified Coulomb):
1. For each surface point, calculate electrostatic potential:
   Φ = Σ q_i / (ε × r_i)
   Where q_i = partial charge of atom i, r_i = distance, ε = dielectric constant
2. Color surface: red (negative) → white (neutral) → blue (positive)
```

---

# CATEGORY 7: Systems Biology

---

## 7.1 Network Viewer (Cytoscape-like)

### Algorithm / Logic
```
Graph layout algorithms:

Force-directed (Fruchterman-Reingold):
1. Initialize: random node positions
2. Calculate repulsive forces between ALL node pairs:
   f_rep = -C_rep × k² / d    (Coulomb-like)
3. Calculate attractive forces along edges:
   f_attr = C_attr × d² / k    (spring-like)
   Where k = sqrt(area / N), d = distance between nodes
4. Update positions: move each node by net force × temperature
5. Decrease temperature (simulated annealing)
6. Repeat for ~100-500 iterations

Edge bundling:
- Group edges with similar endpoints
- Route through shared control points

Rendering:
- Nodes: size by degree/expression value, color by type/pathway
- Edges: width by weight/correlation, dashed for inhibition
- Labels: gene names with collision avoidance
```

---

## 7.2 GO / Pathway Enrichment Analysis

### Algorithm / Logic
```
Gene Ontology Enrichment:
1. Input: gene list (test set) + background gene list
2. For each GO term:
   Construct 2×2 contingency table:
                    In test set    Not in test set
   Annotated to GO:     a               b
   Not annotated:       c               d
   
3. Fisher's exact test:
   P = C(a+b,a) × C(c+d,c) / C(N,a+c)
   One-sided (enrichment): sum probabilities for tables more extreme
   
4. Multiple testing correction:
   Benjamini-Hochberg FDR: 
     - Sort p-values
     - adjusted_p[i] = p[i] × N / rank[i]
     - Ensure monotonicity
   
5. Report GO terms with adjusted p < 0.05

KEGG/Reactome Pathway Enrichment:
Same statistical framework, just using pathway gene sets instead of GO terms
```

### API Route
```
POST /api/tools/systems-biology/enrichment
Body: {
  geneList: string[],
  background: string[],        // Or "genome" for built-in
  database: "GO" | "KEGG" | "Reactome",
  ontology: "BP" | "MF" | "CC",  // GO only
  pvalueThreshold: number,
  correction: "BH" | "bonferroni"
}
Response: {
  enrichedTerms: [{
    termId: string,
    termName: string,
    pvalue: number,
    adjustedPvalue: number,
    enrichmentFold: number,
    genesInTerm: string[],
    overlapGenes: string[]
  }]
}
```

---

# CATEGORY 8: Functional Annotation

---

## 8.1 InterPro / Pfam / SMART / CDD Search

### Algorithm / Logic
```
All domain databases use profile matching:

1. Profile HMM matching (simplified):
   - Profile HMM: position-specific emission and transition probabilities
   - Viterbi algorithm: find most probable path through HMM
   
   For each position i in model, state s:
     V(i,s) = max over previous states s':
       V(i-1,s') × transition(s'→s) × emission(s,observation_i)
   
   Traceback from max V(final) to get alignment
   
   Score = log-odds (model / null model)
   E-value from calibrated score distribution

2. Simplified implementation:
   - Build PSSM profiles from known domain alignments
   - Score query protein against each profile
   - Report matches above threshold
   
3. Domain databases to include (pre-built profiles):
   - Pfam: ~20,000 protein families
   - SMART: signaling/extracellular domains
   - CDD: NCBI conserved domain database
   - Include at least 100 common domains for the web tool
```

---

## 8.2 Gene ID Converter / UniProt Search

### Algorithm / Logic
```
Gene ID Conversion:
1. Maintain mapping tables between ID systems:
   - Gene Symbol ↔ Entrez Gene ID ↔ Ensembl Gene ID ↔ UniProt ID ↔ RefSeq
2. Use local mapping files or API calls to UniProt/NCBI
3. Handle organism-specific mappings
4. Support batch conversion

UniProt Annotation fetch:
1. Query UniProt REST API: https://rest.uniprot.org/uniprotkb/{id}
2. Parse response for:
   - Function description
   - GO terms
   - Domain annotations
   - Subcellular location
   - Tissue expression
   - Disease associations
```

---

# CATEGORY 9: Comparative Genomics

---

## 9.1 Genome Alignment / Synteny

### Algorithm / Logic
```
WHOLE GENOME ALIGNMENT (MUMmer-like):
1. Find Maximal Unique Matches (MUMs):
   - Build suffix tree of reference genome
   - Find all maximal matches to query genome
   - Filter for unique matches (occur exactly once in each genome)
2. Chain MUMs:
   - Find longest increasing subsequence of MUM positions
   - This gives collinear set of anchors
3. Extend/fill gaps between anchors with banded alignment

SYNTENY DETECTION:
1. Identify orthologs between two genomes
2. Find syntenic blocks: groups of ≥3 orthologs in same order and orientation
3. Detect rearrangements: inversions, translocations, duplications
4. Visualize with dot plot or linear comparison
```

### API Route
```
POST /api/tools/comparative/synteny
Body: {
  genome1: string,            // FASTA
  genome2: string,
  minBlockSize: number,       // Minimum syntenic block size
  annotations1: string,       // GFF (optional)
  annotations2: string
}
Response: {
  syntenyBlocks: [{
    genome1: { chrom: string, start: number, end: number },
    genome2: { chrom: string, start: number, end: number },
    orientation: "+" | "-",
    genes: number
  }],
  dotPlotData: { x: number[], y: number[] }
}
```

---

## 9.2 ANI Calculator (Average Nucleotide Identity)

### Algorithm / Logic
```
1. Fragment genome 1 into 1000bp fragments
2. BLAST each fragment against genome 2
3. Keep hits with:
   - Identity ≥ 30%
   - Alignment length ≥ 70% of fragment length
   - E-value < 1e-15
4. ANI = mean identity of all retained hits
5. Aligned fraction = fragments with hits / total fragments

Interpretation:
  ANI > 95% → same species
  ANI > 70% → same genus
```

---

# CATEGORY 10: Transcriptomics

---

## 10.1 TPM / FPKM Calculator

### Algorithm / Logic
```
RPKM (Reads Per Kilobase per Million):
  RPKM_i = (reads_i × 10^9) / (total_reads × gene_length_i)

FPKM: same as RPKM but for paired-end (fragments instead of reads)

TPM (Transcripts Per Million):
  1. RPK_i = reads_i / (gene_length_i / 1000)
  2. scaling_factor = Σ RPK_i / 10^6
  3. TPM_i = RPK_i / scaling_factor

Key difference: TPM always sums to 1,000,000 across samples → comparable between samples
RPKM/FPKM do NOT sum to the same total → NOT directly comparable
```

### API Route
```
POST /api/tools/transcriptomics/normalize
Body: {
  counts: number[][],
  geneLengths: number[],
  method: "TPM" | "FPKM" | "RPKM" | "CPM"
}
Response: {
  normalizedMatrix: number[][],
  sampleTotals: number[]
}
```

---

## 10.2 DESeq2 / EdgeR Interface

### Algorithm / Logic
```
Already detailed in Category 3 (RNA-Seq Analysis section).

EdgeR differences from DESeq2:
- Uses TMM normalization instead of median-of-ratios
- Estimates tagwise dispersion with empirical Bayes
- Uses exact test (for simple designs) or GLM (for complex)

TMM (Trimmed Mean of M-values):
1. Choose a reference sample (highest total)
2. For each sample vs reference:
   M = log2(count_gene_sample / count_gene_ref) × weight
   Trim extreme 30% of M values and 5% of A values
   TMM factor = 2^(weighted mean of trimmed M values)
3. Effective library size = library_size × TMM_factor
```

---

## 10.3 Single Cell RNA-Seq Analysis

### Algorithm / Logic
```
1. QUALITY CONTROL:
   - Filter cells: min genes per cell (200), max genes (2500), max mito% (5%)
   - Filter genes: min cells expressing (3)

2. NORMALIZATION (Seurat-like):
   - Log-normalize: normalized = log(count/total × 10000 + 1)
   
3. FEATURE SELECTION:
   - Find highly variable genes using mean-variance trend
   - Select top 2000 variable genes

4. DIMENSIONALITY REDUCTION:
   a. PCA on variable genes → top 50 PCs
   b. UMAP or t-SNE on top PCs for visualization
   
   UMAP algorithm:
   - Build k-nearest neighbor graph in PC space
   - Construct fuzzy topological representation
   - Optimize low-dimensional embedding to preserve topology
   - Uses stochastic gradient descent
   
   t-SNE algorithm:
   - Compute pairwise affinities using Gaussian kernel
   - P_j|i = exp(-||xi-xj||²/2σi²) / Σ exp(-||xi-xk||²/2σi²)
   - Symmetrize: P_ij = (P_j|i + P_i|j) / 2N
   - Minimize KL divergence between P and Q (Student t-distribution in low dim)

5. CLUSTERING (Louvain community detection):
   a. Build shared nearest neighbor (SNN) graph
   b. Louvain optimization of modularity:
      Q = (1/2m) Σ [A_ij - k_i × k_j/(2m)] × δ(c_i, c_j)
   c. Iteratively merge communities to maximize Q

6. MARKER GENE DETECTION:
   - For each cluster, compare to all other clusters
   - Wilcoxon rank-sum test for each gene
   - Report top markers per cluster (high fold change + low p-value)
```

### API Route
```
POST /api/tools/transcriptomics/single-cell
Body: {
  countMatrix: number[][],     // genes × cells (sparse)
  geneNames: string[],
  cellNames: string[],
  steps: ["qc", "normalize", "pca", "cluster", "markers"],
  nPCs: number,
  resolution: number           // Clustering resolution
}
Response: {
  qcStats: { cellsKept: number, genesKept: number },
  clusters: number[],          // Cluster assignment per cell
  umap: { x: number[], y: number[] },
  markers: { [cluster: string]: [{ gene: string, pval: number, fc: number }] }
}
```

---

# CATEGORY 11: Metagenomics

---

## 11.1 Diversity Metrics

### Algorithm / Logic
```
ALPHA DIVERSITY (within-sample):

Shannon Index: H' = -Σ p_i × ln(p_i)
  Where p_i = proportion of species i
  Higher H' = more diverse

Simpson Index: D = 1 - Σ p_i²
  Range: 0 (low diversity) to 1 (high diversity)

Chao1 (richness estimator):
  Chao1 = S_obs + (f1² / (2 × f2))
  S_obs = observed species, f1 = singletons, f2 = doubletons

Observed Species: Simply count species with abundance > 0

Faith's PD (Phylogenetic Diversity):
  Sum of branch lengths in phylogenetic tree covering observed species

BETA DIVERSITY (between-sample):

Bray-Curtis dissimilarity:
  BC = 1 - (2 × Σ min(x_i, y_i)) / (Σ x_i + Σ y_i)

Jaccard: J = |A ∩ B| / |A ∪ B|

UniFrac (Phylogenetic):
  Unweighted: fraction of branch lengths unique to one sample
  Weighted: branch lengths weighted by abundance difference

RAREFACTION:
1. For sample with N total reads and S observed species:
2. For each depth d (10, 20, 50, 100, 200, ...N):
   Expected species = S - Σ C(N-n_i, d) / C(N, d)
3. Plot: rarefaction curve (depth vs expected species)
4. Curves plateauing → sufficient sequencing depth
```

### API Route
```
POST /api/tools/metagenomics/diversity
Body: {
  abundanceMatrix: number[][],  // species × samples
  speciesNames: string[],
  sampleNames: string[],
  metrics: ["shannon", "simpson", "chao1", "bray-curtis", "jaccard"],
  rarefactionDepths: number[]
}
Response: {
  alpha: {
    [sample: string]: { shannon: number, simpson: number, chao1: number, observed: number }
  },
  beta: {
    metric: string,
    matrix: number[][]
  },
  rarefaction: {
    [sample: string]: { depths: number[], species: number[] }
  }
}
```

---

# CATEGORY 12: Evolution

---

## 12.1 Ka/Ks (dN/dS) Ratio

### Algorithm / Logic
```
Ka/Ks (or dN/dS or ω) = ratio of nonsynonymous to synonymous substitution rates

1. Align two coding DNA sequences (codon-aware alignment)
2. Count substitutions at each codon position:
   
   Nei-Gojobori method:
   a. For each codon pair between the two sequences:
      - Count synonymous sites (S_s) and non-synonymous sites (S_n):
        For each position in a codon, count how many of the 3 possible
        changes would be synonymous (S) vs non-synonymous (N)
        
      - Count observed substitutions:
        If codons differ at 1 position: straightforward
        If differ at 2-3 positions: average over all evolutionary paths
        
   b. Sum across all codon pairs:
      p_S = synonymous_substitutions / synonymous_sites
      p_N = nonsynonymous_substitutions / nonsynonymous_sites
      
   c. Jukes-Cantor correction:
      dS = -(3/4) × ln(1 - (4/3) × p_S)
      dN = -(3/4) × ln(1 - (4/3) × p_N)
      
   d. ω = dN/dS

Interpretation:
  ω < 1: Purifying selection (most genes)
  ω = 1: Neutral evolution
  ω > 1: Positive/diversifying selection
```

### API Route
```
POST /api/tools/evolution/ka-ks
Body: {
  sequence1: string,           // Coding DNA (CDS)
  sequence2: string,
  method: "ng86" | "lwl85" | "yn00",
  geneticCode: number
}
Response: {
  ka: number,
  ks: number,
  kaKsRatio: number,
  synonymousSites: number,
  nonsynonymousSites: number,
  interpretation: string
}
```

---

## 12.2 Conservation Score

### Algorithm / Logic
```
From a multiple sequence alignment:

Rate4Site algorithm (simplified):
1. For each column in the alignment:
   - Calculate evolutionary rate using phylogenetic tree
   - Faster rate → less conserved
   
Simplified approach (no tree needed):
1. For each column:
   a. Count distinct residues
   b. Shannon entropy: H = -Σ f_i × log2(f_i)
   c. Conservation = 1 - H/log2(20)  (for protein)
   d. Or use BLOSUM-weighted scoring:
      Score = Σ_i Σ_j f_i × f_j × BLOSUM62[i][j]

2. Z-score normalize across all columns
3. Scores < -1 = highly conserved; > 1 = variable
```

---

## 12.3 Population Genetics

### Algorithm / Logic
```
ALLELE FREQUENCIES:
  p = count_allele_1 / (2 × N_individuals)
  q = 1 - p
  Hardy-Weinberg: p² + 2pq + q² = 1
  Chi-square test for HWE deviation

LINKAGE DISEQUILIBRIUM:
  D = P(AB) - P(A)×P(B)
  D' = D / D_max (normalized)
  r² = D² / (P(A)×P(a)×P(B)×P(b))

HAPLOTYPE INFERENCE (EM algorithm):
  1. Start with random haplotype frequencies
  2. E-step: Calculate probability of each possible haplotype pair
     for each individual's genotype
  3. M-step: Update haplotype frequencies from expected counts
  4. Repeat until convergence

F-STATISTICS:
  F_ST = (H_T - H_S) / H_T
  Where H_T = total heterozygosity, H_S = subpopulation heterozygosity
  F_ST > 0.25 → great genetic differentiation
```

---

# CATEGORY 13: Molecular Biology Utilities

---

## 13.1 Plasmid Map Generator

### Algorithm / Logic
```
1. Parse plasmid sequence + features (GenBank format)
2. Circular visualization:
   - Circle circumference = sequence length
   - Map each feature to an arc (start_angle, end_angle)
   - Feature types: CDS, promoter, terminator, origin, resistance gene
   - Color by feature type
   - Draw arrows for directional features (CDS, promoters)
3. Mark restriction sites as radial ticks
4. Label features with gene names
5. Show sequence length in center
6. Interactive: click features for details
```

---

## 13.2 Ligation Simulator

### Algorithm / Logic
```
1. Input: vector (cut with enzyme X) + insert (cut with enzyme Y)
2. Check compatibility:
   - Sticky ends must be complementary
   - e.g., EcoRI generates 5'-AATT overhang → compatible with itself
   - BamHI (GATC) compatible with BglII (GATC) overhang
3. Enumerate possible ligation products:
   - Vector self-ligation (if compatible ends)
   - Insert in forward orientation
   - Insert in reverse orientation
   - Multiple inserts (tandem)
4. Generate ligated sequences
5. Check reading frame maintenance
```

---

## 13.3 Gibson Assembly / Golden Gate Design

### Algorithm / Logic
```
GIBSON ASSEMBLY:
1. Input: list of fragments to assemble
2. Design overlaps (20-40bp) between adjacent fragments:
   - Take last 20bp of fragment N + first 20bp of fragment N+1
   - Check overlap Tm (should be 50-65°C)
   - Check for secondary structures in overlap
3. Generate primer sequences:
   - Forward primer: overlap_with_previous + annealing_to_fragment_start
   - Reverse primer: reverse_complement(overlap_with_next + annealing_to_fragment_end)

GOLDEN GATE:
1. Input: list of fragments to assemble in specific order
2. Design unique 4bp overhangs between adjacent fragments
3. Choose type IIS enzyme (BsaI, BbsI) → cuts outside recognition site
4. Ensure no internal recognition sites in fragments (or domesticate them)
5. Design overhangs to enforce directional, ordered assembly
```

---

# CATEGORY 14: Biological Calculators

---

## 14.1 Dilution Calculator

### Algorithm / Logic
```
C1 × V1 = C2 × V2
Where:
  C1 = initial concentration
  V1 = volume of stock solution needed
  C2 = final concentration
  V2 = final volume

Serial dilution:
  For N-fold dilution: take V/(N) of previous, add V×(N-1)/N diluent
  n dilutions → final concentration = C1 / N^n
```

---

## 14.2 Buffer Calculator

### Algorithm / Logic
```
Henderson-Hasselbalch equation:
  pH = pKa + log10([A⁻]/[HA])

Given target pH and buffer:
  1. Look up pKa of buffer (e.g., Tris: pKa = 8.06 at 25°C)
  2. Calculate ratio [A⁻]/[HA] = 10^(pH - pKa)
  3. Calculate amounts:
     [HA] = total_concentration / (1 + ratio)
     [A⁻] = total_concentration × ratio / (1 + ratio)
  4. Account for temperature:
     ΔpKa/°C for Tris = -0.028 (pKa decreases as temp increases)

Common buffers and pKa values:
  Phosphate: 2.15, 7.20, 12.35
  Tris: 8.06
  HEPES: 7.48
  MES: 6.10
  MOPS: 7.20
  Citrate: 3.13, 4.76, 6.40
```

### API Route
```
POST /api/tools/calculators/buffer
Body: {
  buffer: "tris" | "phosphate" | "hepes" | "custom",
  targetPH: number,
  totalConcentration: number,  // mM
  volume: number,              // mL
  temperature: number,         // °C
  customPKa: number            // For custom buffers
}
Response: {
  acidAmount: number,           // grams or mL
  baseAmount: number,
  adjustPH: string,            // "add HCl" or "add NaOH"
  effectiveRange: string       // "pH 7.0 - 9.0"
}
```

---

## 14.3 Molarity / OD260 / Concentration Calculators

### Algorithm / Logic
```
MOLARITY:
  M = mass (g) / (MW (g/mol) × volume (L))
  mass = M × MW × V

OD260 for DNA:
  Concentration (μg/mL) = OD260 × dilution_factor × extinction_coefficient
  dsDNA: 1 OD260 = 50 μg/mL
  ssDNA: 1 OD260 = 33 μg/mL
  RNA:   1 OD260 = 40 μg/mL
  Protein: 1 OD280 = ~1 mg/mL (varies by protein)
  
  OD260/280 ratio:
    Pure DNA: 1.8
    Pure RNA: 2.0
    Protein contamination: < 1.7

EXTINCTION COEFFICIENT (Protein):
  ε = nTrp × 5500 + nTyr × 1490 + nCystine × 125
  (Pace et al., at 280nm in water)
  
  Concentration = Absorbance / (ε × path_length)
```

### API Route
```
POST /api/tools/calculators/concentration
Body: {
  type: "od260" | "molarity" | "dilution" | "extinction",
  ...type-specific params
}
```

---

# CATEGORY 15: List Comparison Tools

---

## 15.1 Set Operations (Compare Lists, Venn Diagrams, UpSet Plots)

### Algorithm / Logic
```
ALL SET OPERATIONS use standard set theory:

1. PARSE INPUTS:
   - Split each list by newline, comma, tab, or space
   - Trim whitespace from each element
   - Optionally: case-insensitive comparison (lowercase all)

2. OPERATIONS:
   Union: A ∪ B = set of all elements in A or B
   Intersection: A ∩ B = set of elements in both A and B
   Difference: A \ B = set of elements in A but not B
   Symmetric Difference: A △ B = (A ∪ B) \ (A ∩ B)
   
   For multiple lists (3, 4, 5):
   All possible combinations of intersections/differences

3. VENN DIAGRAM:
   For 2 sets: 2 circles, 3 regions (A only, B only, A∩B)
   For 3 sets: 3 circles, 7 regions
   For 4 sets: 4 ellipses, 15 regions
   For 5 sets: 5 ellipses, 31 regions (or use Edwards diagram)
   
   Calculate size of each region:
   For 3 sets:
     Only A: |A| - |A∩B| - |A∩C| + |A∩B∩C|
     A∩B only: |A∩B| - |A∩B∩C|
     A∩B∩C: |A∩B∩C|
     etc.
   
   SVG rendering with proportional areas (optional)

4. UPSET PLOT:
   - Binary membership matrix: rows = elements, columns = sets
   - Group elements by their membership pattern
   - Horizontal bar: set sizes
   - Vertical bar: intersection sizes
   - Dot matrix: which sets participate in each intersection
   - Sort intersections by size (decreasing)

5. DUPLICATE HANDLING:
   - Find duplicates within a list: elements that appear > 1 time
   - Remove duplicates: keep first occurrence
   - Find duplicates across lists
```

### API Route
```
POST /api/tools/list-tools/compare
Body: {
  lists: { [name: string]: string[] },    // 2-5 named lists
  operations: ["union", "intersection", "difference", "symmetric-difference",
               "unique", "common", "duplicates"],
  caseSensitive: boolean,
  outputFormat: "list" | "venn" | "upset"
}
Response: {
  results: {
    union: string[],
    intersection: string[],
    differences: { [key: string]: string[] },   // "A-B", "B-A"
    symmetricDifference: string[],
    uniqueToEach: { [list: string]: string[] },
    duplicatesInEach: { [list: string]: string[] }
  },
  vennData: {
    regions: [{ sets: string[], size: number, elements: string[] }]
  },
  upsetData: {
    sets: string[],
    intersections: [{ sets: boolean[], size: number, elements: string[] }]
  },
  counts: {
    [list: string]: number
  }
}
```

### Implementation Prompt
```
Implement comprehensive list comparison tools:
1. Support 2-5 lists with any delimiter (auto-detect newline, comma, tab)
2. All set operations: union, intersection, difference (A-B and B-A), symmetric
   difference
3. For N lists, compute ALL 2^N - 1 intersection combinations
4. Venn diagram rendering using SVG:
   - 2 sets: two overlapping circles
   - 3 sets: three overlapping circles
   - 4 sets: Edwards-style with ellipses
   - 5 sets: Edwards-style or Euler diagram
   - Label each region with count and optionally with element names
   - Color each set differently with transparency for overlaps
5. UpSet plot rendering:
   - Binary membership matrix
   - Sorted bar chart of intersection sizes
   - Connected dot matrix showing set participation
   - Set size bars on the left
6. Gene-specific features:
   - Gene ID conversion (Ensembl ↔ Symbol ↔ Entrez)
   - Case-insensitive matching option
   - Alias matching (gene synonyms)
```

---

## 15.2 Gene Matching / Conversion Tools

### Algorithm / Logic
```
GENE ID CONVERTER:
1. Mapping tables between:
   - Gene symbols (BRCA1, TP53, etc.)
   - Entrez Gene IDs (672, 7157)
   - Ensembl Gene IDs (ENSG00000012048)
   - UniProt IDs (P38398)
   - RefSeq IDs (NM_007294)
2. Source: downloaded from BioMart/NCBI
3. Handle: species specification, ambiguous symbols, deprecated IDs

GENE NAME CLEANER:
1. Strip leading/trailing whitespace
2. Remove version numbers (ENSG00000012048.5 → ENSG00000012048)
3. Standardize case (gene symbols: uppercase for human, sentence case for mouse)
4. Map aliases to official symbols
5. Flag and correct common typos
6. Remove non-gene entries (e.g., "N/A", "---", numbers)

MISSING GENE FINDER:
1. Compare gene list against reference gene set (e.g., all human genes)
2. Report: genes not found in reference, possible matches (fuzzy matching)
3. Suggest corrections for near-misses (Levenshtein distance ≤ 2)
```

---

# CATEGORY 16: Rosalind-style Educational Tools

> These tools implement classic bioinformatics algorithm challenges for learning.

---

## 16.1 Core String Problems

### Algorithm / Logic
```
DNA COUNT: Count occurrences of A, C, G, T in a DNA string

RNA COUNT: Convert T→U and count A, C, G, U

REVERSE COMPLEMENT: Already covered in Category 1

GC CONTENT: Already covered in Category 1

CONSENSUS STRING from profile matrix:
1. Given N sequences of length L (aligned)
2. Build profile matrix (4 × L): count A, C, G, T at each position
3. Consensus = character with max count at each position

OVERLAP GRAPH:
1. For sequences s_i and s_j:
   Add edge s_i → s_j if suffix(s_i, k) = prefix(s_j, k)
   (overlap of length k, typically k=3)
2. Build directed graph of all such edges
3. Output adjacency list

LONGEST COMMON SUBSEQUENCE (LCS):
Dynamic programming:
  LCS[i][j] = LCS[i-1][j-1] + 1  if s[i] == t[j]
             = max(LCS[i-1][j], LCS[i][j-1])  otherwise
Traceback to reconstruct the subsequence.
Time: O(m × n)

LONGEST INCREASING SUBSEQUENCE:
Patience sorting / binary search approach:
  For each element, binary search for its position in the tails array
  Time: O(n log n)
```

---

## 16.2 Graph & String Algorithms

### Algorithm / Logic
```
EULERIAN PATH / CYCLE:
1. Build graph from edges
2. Check: Eulerian cycle exists iff all nodes have even degree
   Eulerian path exists iff exactly 0 or 2 nodes have odd degree
3. Hierholzer's algorithm:
   - Start at any node (or odd-degree node for path)
   - Follow edges, removing them, until stuck (back at start)
   - If unused edges remain: find node on current path with unused edges
   - Start new sub-tour from there
   - Splice sub-tour into main tour
   Time: O(V + E)

K-MER FREQUENCY:
1. For each k-mer (substring of length k):
   Count occurrences using sliding window
2. Output: all k-mers and their counts
3. Optional: find most frequent k-mers
4. For genome-scale: use hash maps; for exact: sort-based counting

SUFFIX TREE / SUFFIX ARRAY:
Suffix Array:
  1. Generate all suffixes of string S
  2. Sort suffixes lexicographically
  3. Store only starting positions
  4. LCP array: longest common prefix between adjacent sorted suffixes
  Use: pattern matching in O(m × log n), find repeats, LCS of two strings

BURROWS-WHEELER TRANSFORM:
  1. Generate all rotations of string (with $)
  2. Sort rotations
  3. BWT = last column
  Inverse BWT: first-last property reconstruction
  
  Relation to FM-index (used in read alignment):
  BWT + occurrence table + C array = FM-index

TRIE CONSTRUCTION:
  1. Initialize with empty root
  2. For each pattern:
     Walk from root, create new nodes for new characters
  Use: multi-pattern matching, prefix queries
  
HIDDEN MARKOV MODELS:
  States: hidden, emit observable symbols
  Viterbi: find most likely state path
  Forward: calculate P(observations | model)
  Baum-Welch: learn model parameters from observations
```

---

## 16.3 Mass Spectrometry / Assembly Problems

### Algorithm / Logic
```
GENOME ASSEMBLY (de Bruijn graph approach):
1. Break reads into k-mers
2. Build de Bruijn graph: 
   - Nodes = (k-1)-mers
   - Edge between prefix and suffix of each k-mer
3. Find Eulerian path → assembled sequence

MASS SPECTROMETRY:
Peptide identification from mass spectrum:
1. Build theoretical spectrum:
   For a peptide of length N:
   - Calculate mass of all prefix fragments (b-ions)
   - Calculate mass of all suffix fragments (y-ions)
2. Match observed peaks to theoretical spectrum
3. Score = number of matching peaks
4. For sequencing: dynamic programming over mass values

Amino acid monoisotopic masses:
G:57.02, A:71.04, V:99.07, L:113.08, I:113.08, P:97.05, F:147.07,
W:186.08, M:131.04, S:87.03, T:101.05, C:103.01, Y:163.06, H:137.06,
D:115.03, E:129.04, N:114.04, Q:128.06, K:128.09, R:156.10
```

---

# CATEGORY 17: File Conversion Tools

> Most conversion logic is already covered in Category 2 (parsers). Additional conversions:

---

## 17.1 Additional Format Conversions

### Algorithm / Logic
```
SAM ↔ BAM:
  BAM is compressed (gzip/BGZF) binary version of SAM
  Web implementation: use pako.js for gzip compression/decompression
  Convert SAM text → binary encoding with BGZF blocks

BAM ↔ CRAM:
  CRAM = reference-based compression of BAM
  Stores only differences from reference
  Much smaller than BAM

VCF → CSV:
  Parse VCF, extract columns: CHROM, POS, ID, REF, ALT, QUAL, FILTER
  Expand INFO field into separate columns
  Write as comma-separated values

Newick ↔ Nexus:
  Nexus format wraps Newick tree with metadata:
  #NEXUS
  BEGIN TREES;
    TREE tree1 = [&R] (A:0.1,B:0.2):0.3;
  END;
  Parse Newick tree string, wrap/unwrap in Nexus blocks

PDB ↔ mmCIF:
  PDB: fixed-width column format (ATOM records: columns 1-80)
  mmCIF: key-value pair format (_atom_site.*)
  Map corresponding fields between formats
```

---

# CATEGORY 18: Visualization Tools

---

## 18.1 Visualization Implementation Guide

### Algorithm / Logic and Implementation

```
All visualizations use SVG (via D3.js) or Canvas for performance.

GENOME BROWSER:
  - Load reference sequence + GFF annotations
  - Render tracks: genes, CDS, mRNA, tRNA, repeats
  - Show features as colored rectangles/arrows
  - Zoom levels: chromosome → gene region → base pair
  - Use virtual scrolling for large genomes

SEQUENCE LOGOS:
  For each position in a MSA:
  1. Calculate information content: IC = log2(N) + Σ f_i × log2(f_i)
     Where N = alphabet size (4 for DNA, 20 for protein)
  2. Height of each letter = f_i × IC (proportional to frequency × information)
  3. Stack letters tallest at top
  4. Use custom font rendering for biological letters

DOT PLOTS:
  For sequences A (length m) and B (length n):
  1. Create m × n matrix
  2. Mark (i,j) if A[i] == B[j]
  3. Apply window filter: mark only if w consecutive matches in diagonal
  4. Diagonal lines → conserved regions
  5. Horizontal offset → insertions; vertical offset → deletions
  6. Reverse diagonals → inversions

CIRCULAR GENOME VIEWER:
  1. Map genome coordinates to angles: angle = (position / genome_length) × 360°
  2. Draw concentric rings:
     - Outer: genome coordinates (tick marks every N bases)
     - Middle: forward strand genes, reverse strand genes
     - Inner: GC content, GC skew
  3. Use SVG arcs for features

CHROMOSOME IDEOGRAMS:
  1. Draw chromosome outlines (rectangles with rounded ends)
  2. Band patterns from cytoband data
  3. Color bands by staining pattern (Giemsa bands)
  4. Mark regions of interest (genes, variants)

COVERAGE PLOTS:
  1. Parse per-position depth data
  2. Area chart with x = position, y = depth
  3. Color by depth thresholds (low/medium/high)
  4. Optional: overlay annotations

UMAP / t-SNE:
  Already covered in Single Cell RNA-Seq section.
  Render as scatter plot with D3.js, color by cluster/metadata.

HEATMAPS / VOLCANO / MA / PCA:
  Already covered in Categories 3 and 10.
```

### Implementation Prompt
```
Implement a unified visualization module using D3.js v7:

1. Shared utilities:
   - Responsive SVG container with zoom/pan
   - Color scales: sequential, diverging, categorical
   - Tooltip system with formatted content
   - Legend generator
   - Export to SVG/PNG/PDF

2. Chart types (each as a reusable component):
   - Scatter plot (PCA, UMAP, t-SNE, volcano, MA)
   - Heatmap with dendrograms
   - Bar charts (horizontal/vertical, stacked, grouped)
   - Line/area charts (coverage, GC content)
   - Circular layouts (genome viewer, phylogenetic trees)
   - Network graphs (force-directed, hierarchical)
   - Sequence-specific: logos, dot plots, genome browser tracks

3. Interactive features:
   - Brush selection for zooming
   - Click-to-select elements
   - Linked views (select in one chart, highlight in another)
   - Dynamic filtering controls
```

---

# CATEGORY 20: Workflow & Reproducibility

---

## 20.1 Workflow Builder

### Algorithm / Logic
```
DRAG-AND-DROP WORKFLOW BUILDER:

1. DATA MODEL:
   Workflow = Directed Acyclic Graph (DAG)
   Nodes = tools/steps (e.g., "BLAST", "Filter", "Plot")
   Edges = data flow connections (output of one → input of another)

   Node types:
   - Input: file upload, paste text, select database
   - Processing: any tool from categories 1-18
   - Output: download, visualize, summary

2. VALIDATION:
   - Check DAG is valid (no cycles): topological sort
   - Check data type compatibility between connected nodes
   - Check all required inputs are connected
   - Verify parameter completeness

3. EXECUTION ENGINE:
   a. Topological sort of the DAG
   b. Execute nodes in order:
      - Each node calls its corresponding API route
      - Pass output data to connected downstream nodes
   c. Track status: pending → running → completed / failed
   d. Allow retry of failed nodes
   
4. TEMPLATES:
   Pre-built workflows for common analyses:
   - DNA-Seq: FASTQ → QC → Align → Call Variants → Annotate → Filter → Report
   - RNA-Seq: FASTQ → QC → Align → Count → Normalize → DESeq2 → Plots
   - Metagenomics: FASTQ → QC → Classify → Diversity → Visualize
   - Variant Calling: BAM → GATK → Filter → Annotate → Report

5. REPRODUCIBILITY:
   - Save workflow as JSON (nodes, edges, parameters)
   - Version control (store in Git-compatible format)
   - Provenance tracking: log all inputs, parameters, outputs, timestamps
   - Share workflows via URL or export
```

### API Routes
```
POST /api/workflow/create
Body: { name: string, description: string }

POST /api/workflow/{id}/add-node
Body: { type: string, tool: string, params: object, position: {x, y} }

POST /api/workflow/{id}/add-edge
Body: { source: string, target: string, sourcePort: string, targetPort: string }

POST /api/workflow/{id}/execute
Response: { jobId: string, status: "running" }

GET /api/workflow/{id}/status
Response: { nodes: [{ id, status, progress, output }] }

POST /api/workflow/{id}/save
Body: { format: "json" | "cwl" | "nextflow" }
```

### Implementation Prompt
```
Implement a Galaxy-style workflow builder:

1. FRONTEND:
   - Drag-and-drop canvas using React DnD or similar
   - Tool palette on the left: organized by category
   - Canvas in center: nodes (rounded rectangles) connected by edges (curves)
   - Properties panel on right: configure selected node's parameters
   - Each node shows: tool name, input/output ports, status indicator
   - Draw connections by dragging from output port to input port
   - Validate connections: check data type compatibility

2. BACKEND:
   - Workflow engine: execute nodes in topological order
   - Job queue: track running/pending/completed jobs
   - Data passing: store intermediate results, link between nodes
   - Template system: pre-built workflows as JSON
   - Export: save workflow definition + provenance as JSON

3. REPRODUCIBILITY:
   - Each execution creates a run record:
     { workflow_version, parameters, inputs, outputs, timestamps, status }
   - Store run records for audit trail
   - Allow re-running with modified parameters
```

---

# CROSS-CUTTING IMPLEMENTATION NOTES

---

## Substitution Matrices (MUST INCLUDE)

```javascript
// BLOSUM62 - 20×20 amino acid substitution matrix
// Source: Henikoff & Henikoff, 1992
// Usage: protein alignment scoring
const BLOSUM62 = {
  'A': { 'A':4, 'R':-1, 'N':-2, 'D':-2, 'C':0, 'Q':-1, 'E':-1, 'G':0, 'H':-2, 'I':-1, 'L':-1, 'K':-1, 'M':-1, 'F':-2, 'P':-1, 'S':1, 'T':0, 'W':-3, 'Y':-2, 'V':0 },
  // ... (full 20×20 matrix must be embedded)
};

// NUC44 (EDNAFULL) - nucleotide substitution matrix
// Match: +5, Mismatch: -4
// IUPAC ambiguity codes supported

// PAM250 - older protein matrix, better for divergent sequences
```

## Genetic Code Tables (MUST INCLUDE)
```
Table 1: Standard
Table 2: Vertebrate Mitochondrial
Table 3: Yeast Mitochondrial
Table 5: Invertebrate Mitochondrial
Table 11: Bacterial/Archaeal/Plant Plastid
```

## Error Handling Standards
```
1. Input validation on every endpoint:
   - Sequence character validation
   - Length limits (server-configurable)
   - Format detection and verification
2. Meaningful error messages:
   - "Invalid character 'U' at position 45. Did you mean RNA? Use DNA→RNA converter."
   - "Sequence too short for reliable Tm calculation (minimum: 8nt)"
3. Progress feedback for long computations:
   - Server-Sent Events for real-time progress
   - Estimated time remaining
```

## Performance Limits for Web Implementation
```
- Single sequence: up to 100,000 bp / 30,000 aa
- BLAST database: up to 10 MB total
- MSA: up to 500 sequences × 5,000 positions
- Genome alignment: up to 10 MB genomes
- Read alignment: up to 10,000 reads
- Matrix operations: up to 10,000 × 10,000
- For larger datasets: show warning, suggest downloading desktop tools
```

---

# TOOL COUNT SUMMARY

| Category | Tools | Status |
|----------|-------|--------|
| 1. Sequence Analysis | 33 | Detailed |
| 2. Sequence Utilities | 17 | Detailed |
| 3. Genomics (NGS) | 22 | Detailed |
| 4. Phylogenetics | 10 | Detailed |
| 5. Protein Analysis | 16 | Detailed |
| 6. Protein Structure | 10 | Detailed |
| 7. Systems Biology | 8 | Detailed |
| 8. Functional Annotation | 10 | Detailed |
| 9. Comparative Genomics | 7 | Detailed |
| 10. Transcriptomics | 10 | Detailed |
| 11. Metagenomics | 9 | Detailed |
| 12. Evolution | 7 | Detailed |
| 13. Molecular Biology | 9 | Detailed |
| 14. Biological Calculators | 12 | Detailed |
| 15. List Comparison | 22 | Detailed |
| 16. Rosalind Educational | 25 | Detailed |
| 17. File Conversion | 10 | Detailed |
| 18. Visualization | 17 | Detailed |
| 19. AI-Powered | — | SKIPPED |
| 20. Workflow | 6 | Detailed |
| **TOTAL** | **~260** | |

---

> [!TIP]
> **Implementation Order Recommendation:**
> 1. Start with shared utilities (parsers, matrices, codons)
> 2. Build Category 14 (Calculators) — simplest, builds confidence
> 3. Build Category 2 (Sequence Utilities) — required by everything
> 4. Build Category 1 (Sequence Analysis) — core algorithms, highest value
> 5. Build Category 15 (List Tools) — very popular, relatively simple
> 6. Build Category 4 (Phylogenetics) — depends on alignment
> 7. Continue with remaining categories in any order
