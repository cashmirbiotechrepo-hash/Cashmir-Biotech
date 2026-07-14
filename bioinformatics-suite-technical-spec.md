# Bioinformatics Tool Suite — Technical Logic & Architecture

**Scope note:** Section 19 (AI-Powered Bioinformatics) is intentionally excluded, as requested. Everything else is covered.

## How to think about this before building anything

You have ~300 tool *names*, but they are not 300 different algorithms. They are ~18–20 real algorithms wearing different UI labels. If you build a separate ad-hoc function for every named tool, you'll end up with a gimmick suite — inconsistent results, no statistical rigor, and bugs multiplied 300 times. If instead you build the ~20 **core engines** below once, correctly, then every "tool" becomes a thin parameterized wrapper (a specific scoring matrix, a specific gap penalty, a specific output formatter) around one engine. That's how real tools (EBI, Galaxy, Benchling, SnapGene) are actually architected.

So this document is organized as:
1. Core engines (the real algorithmic substance)
2. How each numbered category maps onto those engines, with what's unique per tool
3. File-format parsers (the unglamorous but essential backbone)
4. API/architecture pattern
5. What makes each category "not a gimmick"

---

## PART 1 — CORE ENGINES

### Engine A: Pairwise Alignment (Dynamic Programming)
Powers: Needleman-Wunsch, Smith-Waterman, Pairwise Alignment (DNA-DNA/Protein-Protein/DNA-Protein), Primer Validation, Primer Specificity Checker, Sequence Identity Matrix (pairwise step), Protein Alignment, Structure Alignment (sequence part).

**Logic:**
- Build an (n+1)×(m+1) scoring matrix `H`.
- **Needleman-Wunsch (global):** every cell is filled, traceback starts at bottom-right, alignment forced end-to-end. Use for full-length comparisons (e.g., two gene variants).
- **Smith-Waterman (local):** identical recurrence but any negative score is clamped to 0, traceback starts at the max-value cell anywhere in the matrix, alignment ends when a 0 is hit. Use for finding the best matching region inside longer/dissimilar sequences (primer-in-genome, domain search).
- **Affine gap penalties (Gotoh's algorithm):** don't use a flat per-gap penalty — real biology penalizes gap *opening* more than gap *extension*. Maintain three matrices (M = match/mismatch, Ix = gap in x, Iy = gap in y) instead of one, so cost = `gapOpen + (length-1)*gapExtend`. This alone is the difference between a real tool and a toy.
- **Scoring matrices:** DNA uses match/mismatch (+1/-1 typical, or EDNAFULL for ambiguity codes). Protein uses substitution matrices — BLOSUM62 for general use, BLOSUM45/PAM250 for more divergent sequences, BLOSUM80/PAM30 for close ones. Ship these as static lookup tables (they're standardized, don't invent your own numbers).
- Complexity: O(n·m) time and space; for long sequences use Hirschberg's algorithm (O(n·m) time, O(min(n,m)) space via divide-and-conquer) so you don't blow memory on chromosome-scale inputs.

**API shape:**
```
POST /api/align/pairwise
{ seq1, seq2, mode: "global"|"local", moleculeType: "dna"|"protein",
  matrix: "blosum62"|"identity", gapOpen: -10, gapExtend: -0.5 }
→ { alignedSeq1, alignedSeq2, score, identity%, similarity%, gaps }
```

### Engine B: Heuristic Alignment / Database Search (BLAST-family)
Powers: BLAST, BLASTN, BLASTP, BLASTX, TBLASTN, TBLASTX, PSI-BLAST, DELTA-BLAST, FASTA Search, LAST.

Full DP alignment against a genome-scale database is O(n·m) per hit and infeasible at scale — this is why BLAST exists. Real logic:
1. **Seeding:** break the query into overlapping words (k-mers) of fixed length (11 for BLASTN, 3 for BLASTP). Index all words from the database (or query) in a hash table.
2. **Extension:** for every exact (or, for protein, "neighborhood" — score ≥ threshold using the substitution matrix) seed match, extend the alignment in both directions *without* gaps first (ungapped extension), stop when score drops T below the current max (X-drop).
3. **Gapped extension:** if the ungapped score clears a threshold, run a banded Smith-Waterman only in the local region around the seed (not the whole matrix) to get the final gapped alignment.
4. **Statistics (this is what most hobby implementations skip and what makes BLAST *correct* rather than a toy):** compute bit score and E-value using Karlin-Altschul statistics: `E = K·m·n·e^(-λS)`, where m,n are query/database lengths, S is raw score, K and λ are matrix-specific constants. Without a real E-value, "significant hit" is meaningless.
5. **Variants are just which alphabet you translate into before seeding:**
   - BLASTN: DNA vs DNA, nucleotide seeds
   - BLASTP: protein vs protein
   - BLASTX: translate query DNA in all 6 frames → protein search
   - TBLASTN: protein query vs 6-frame-translated DNA database
   - TBLASTX: 6-frame translate both sides
   - PSI-BLAST: iterative — build a position-specific scoring matrix (PSSM) from a multiple alignment of hits, re-search with the PSSM, repeat until convergence. This is what lets it find remote homologs.
   - DELTA-BLAST: same as PSI-BLAST but seeds the first-round PSSM from a conserved-domain database instead of starting from scratch.
   - FASTA/LAST: alternative seed-and-extend implementations — same conceptual pipeline, different seed selection (FASTA uses hashed k-tuples + diagonal scoring; LAST uses adaptive seeds and is tuned for large genome-vs-genome alignment).

**API shape:**
```
POST /api/search/blast
{ query, program: "blastn"|"blastp"|"blastx"|"tblastn"|"tblastx",
  database: <indexed set id>, eValueCutoff: 1e-5, wordSize, matrix }
→ { hits: [{ subjectId, score, bitScore, eValue, identity%, alignment }] }
```
Practically: don't reimplement BLAST from scratch for production — wrap the real NCBI BLAST+ binaries or DIAMOND (protein) server-side and expose a clean REST layer. That's not "cheating," that's what every serious bioinformatics web tool does. Reimplement it yourself only if the point is pedagogical (Rosalind-style, see Part 2 §16).

### Engine C: Multiple Sequence Alignment (Progressive Alignment)
Powers: Clustal Omega, MUSCLE, MAFFT, Consensus Sequence Generator, Conserved Region Finder.

Real progressive-alignment pipeline (this is genuinely how Clustal/MUSCLE work, simplified):
1. **All-vs-all pairwise distances:** run Engine A (or a faster k-mer-based distance estimate for speed) between every sequence pair to get a distance matrix.
2. **Guide tree:** cluster the distance matrix with UPGMA or Neighbor-Joining (Engine D) to get an order in which to merge sequences.
3. **Progressive merge:** align the two closest sequences/profiles first (profile-profile alignment: same DP recurrence as Engine A but comparing column-frequency profiles instead of single residues), then progressively add the next-closest sequence/profile per the guide tree, until all are merged.
4. **Refinement (what separates MUSCLE/MAFFT from naive progressive alignment):** iteratively remove one sequence, re-align it against the rest, and keep the change if the overall score improves (iterative refinement) — this fixes early alignment mistakes that pure progressive alignment locks in.
- Conserved Region Finder = post-processing the MSA: compute per-column identity/entropy across all sequences, flag columns above a conservation threshold.
- Consensus Sequence Generator = per-column majority vote (with an ambiguity code if no residue clears >50%).

### Engine D: Distance-Based & Character-Based Phylogenetics
Powers: Neighbor Joining, UPGMA, Maximum Likelihood, Maximum Parsimony, Bootstrap Analysis, Tree Viewer/Editor/Comparison/Annotation, Circular Tree.

- **UPGMA:** repeatedly merge the two closest clusters, assign the new node height at half the distance, update distances by averaging. Assumes a constant molecular clock — fast but biologically naive; use only for quick guide trees, not final phylogenies.
- **Neighbor-Joining (NJ):** corrects UPGMA's clock assumption. At each step compute a Q-matrix `Q(i,j) = (n-2)d(i,j) - Σd(i,k) - Σd(j,k)`, join the pair minimizing Q, compute branch lengths algebraically, recompute distances to the new node, repeat. O(n³) total.
- **Maximum Parsimony:** search tree topologies, score each by minimum number of character-state changes needed (Fitch's algorithm computes this bottom-up in O(n) per tree), keep the topology with fewest changes. Exhaustive search is only feasible for small n — use heuristic search (nearest-neighbor interchange, SPR) for anything realistic.
- **Maximum Likelihood:** pick a substitution model (Jukes-Cantor, Kimura 2-parameter, GTR for DNA; WAG/LG for protein), compute the likelihood of the data given a tree and branch lengths via **Felsenstein's pruning algorithm** (recursive computation of per-site likelihoods up the tree), optimize branch lengths + topology to maximize likelihood (hill-climbing / NNI moves). This is the correct, standard approach — don't approximate it with distance methods and call it ML.
- **Bootstrap Analysis:** resample alignment columns with replacement N times (typically 100–1000), rebuild the tree each time, and report what % of replicates recover each clade — this is the real measure of confidence, not a cosmetic percentage.
- Tree Viewer/Editor/Comparison/Circular Tree = parse/render Newick or Nexus format as a rooted or unrooted tree data structure (nodes with branch lengths + children), then it's a rendering/UI problem, not an algorithmic one. Tree Comparison = Robinson-Foulds distance (count of bipartitions present in one tree but not the other).

### Engine E: Suffix Structures & Exact/k-mer Matching
Powers: Suffix Tree, Suffix Array, Burrows-Wheeler Transform, k-mer Frequency, Trie Construction, Overlap Graph, and underlies BWA/Bowtie2/read alignment.

- **Suffix Array:** sort all suffixes of a string lexicographically, store their starting indices. Build efficiently with SA-IS algorithm (O(n)) rather than naive O(n² log n) sort — matters once sequences are genome-scale.
- **BWT:** derived from the suffix array (take the character preceding each sorted suffix). Enables the **FM-index**, which supports exact substring search in O(m) time regardless of text size — this is literally the core data structure inside BWA and Bowtie2 for aligning millions of reads to a genome quickly.
- **Suffix Tree:** same information as suffix array + LCP array, different data structure (Ukkonen's algorithm builds it in O(n)); use when you need fast arbitrary substring/repeat queries rather than pure alignment.
- **k-mer Frequency:** slide a window of length k across the sequence, hash each k-mer into a count table. Trivial conceptually but the real-world lesson is: use a rolling hash so each step is O(1), not O(k), or memory/time blows up on genome-scale input.
- **Trie Construction:** standard prefix tree over the k-mers or sequence set — used as a building block for the suffix tree and for fast exact-match lookups.
- **Overlap Graph:** for a set of reads, an edge from read A to read B exists if a suffix of A matches a prefix of B by ≥ some threshold length. Build efficiently by indexing all read prefixes/suffixes in a hash/trie rather than doing all-pairs comparison.

### Engine F: Genome Assembly & Read Alignment
Powers: BWA, Bowtie2, HISAT2, STAR, Minimap2, GATK (variant calling side), SAMtools/BCFtools/BEDTools (utility side), Genome Assembly, Eulerian Path/Cycle.

- **Short-read aligners (BWA, Bowtie2):** build an FM-index (Engine E) of the reference genome. For each read, seed exact/near-exact matches via backward search on the FM-index, extend with Smith-Waterman (Engine A) around seeds allowing mismatches/indels, report best alignment(s) with a mapping quality score based on uniqueness of the best hit vs. next-best.
- **Splice-aware aligners (HISAT2, STAR):** same seed-and-extend core, but additionally allow large gaps in the read-to-genome alignment at splice sites, using either a graph-genome index containing known splice junctions (HISAT2) or a two-pass seed-cluster-extend approach that explicitly detects splice junctions from spanning reads (STAR).
- **Minimap2:** built for long, noisy reads (or genome-vs-genome). Uses minimizers (the smallest k-mer in each window, a subsampling trick that keeps only representative k-mers) for fast seeding, then chains colinear seed hits and extends with a banded DP.
- **Genome Assembly (de novo, no reference):** build a **de Bruijn graph** — every k-mer in every read becomes a node (or edge, depending on formulation), nodes are connected if they overlap by k-1 bases. A genome walk corresponds to an **Eulerian path** through this graph (visiting every edge exactly once) — solve with Hierholzer's algorithm. This is real logic behind SPAdes/Velvet-style assemblers, not a toy.
- **Variant Calling (GATK-style):** align reads (above), then per-genomic-position, model the observed bases as a mixture given ploidy and sequencing error rate, compute genotype likelihoods (Bayesian: P(genotype | reads) ∝ P(reads | genotype)·P(genotype)), call the most probable genotype, apply base/mapping quality recalibration and local realignment around indels before calling to reduce false positives.
- **SAMtools/BCFtools/BEDTools:** these are format-manipulation + interval-algebra tools, not novel algorithms — see Part 3 (interval trees, format parsers).

### Engine G: Statistical/Count-Based Expression Analysis
Powers: RNA-Seq Analysis, Differential Expression, DESeq2 Interface, EdgeR Interface, Expression Matrix, TPM/FPKM Calculator, RNA-Seq QC, Volcano Plot, PCA Plot, Heatmap Generator, Single Cell RNA-Seq, Pseudo-bulk Analysis, Trajectory Analysis, Cell Clustering.

- **From reads to counts:** align reads (Engine F) to a transcriptome/genome, count reads overlapping each gene/exon (interval overlap, Part 3).
- **Normalization (do NOT skip this — it's what makes DE analysis real):**
  - TPM: `reads_per_gene / gene_length_kb`, then scale so all TPMs sum to 1,000,000 per sample. Corrects for both gene length and sequencing depth, comparable *within* a sample.
  - FPKM: same numerator, but divided by total mapped reads (millions) instead of rescaled to sum-to-1M — comparable within a sample but not reliably across samples (this is why TPM is now preferred; mention this if the tool is user-facing).
  - DESeq2's median-of-ratios: for each gene, compute the geometric mean across samples; for each sample, take the median of (gene count / geometric mean) across all genes — that median is the sample's size factor. Robust to a few very highly expressed genes dominating the normalization, unlike simple total-count scaling.
  - EdgeR's TMM (trimmed mean of M-values): trim extreme log-fold-change and extreme-intensity genes, average the rest to get a scaling factor between sample pairs.
- **Differential expression statistics:** model gene counts with a **negative binomial distribution** (not a t-test/normal — count data is overdispersed relative to Poisson). DESeq2 fits a GLM per gene, shares information across genes to shrink dispersion estimates (empirical Bayes), computes a Wald test or likelihood-ratio test per gene for the fold-change coefficient. EdgeR does the same with a slightly different dispersion-estimation approach (empirical Bayes tagwise dispersion). Both then apply **Benjamini-Hochberg FDR correction** across all genes tested — never report raw p-values as "significant" across thousands of genes.
- **Volcano Plot:** literally just scatter log2(fold change) on x vs. -log10(adjusted p-value) on y, with significance thresholds as reference lines. No new algorithm — it's a rendering of the DE table above; the "logic" is entirely in getting the DE numbers right upstream.
- **PCA Plot:** mean-center (and typically variance-stabilize, e.g. DESeq2's `vst`) the expression matrix, compute via **SVD** (not naive covariance-matrix eigendecomposition — SVD is numerically more stable), plot samples on the top 2–3 principal components.
- **Heatmap Generator:** hierarchical clustering (same UPGMA-style agglomerative clustering as Engine D, but on gene-expression distance, typically 1-correlation or Euclidean) on both genes and samples, reorder matrix accordingly, render as a color grid.
- **Single-cell (scRNA-seq):** same count → normalize pipeline per cell instead of per sample; **Cell Clustering** = graph-based clustering (build a k-nearest-neighbor graph of cells in PCA space, then Louvain/Leiden community detection — this is the real modern approach, not k-means); **Trajectory Analysis** = build a minimum spanning tree or graph over cluster centroids/cells in reduced-dimension space to infer a pseudo-time ordering (diffusion pseudotime / Monocle-style approach); **Pseudo-bulk** = sum/average single-cell counts within a cluster to produce one "bulk-like" sample per cluster per condition, then reuse the DESeq2/EdgeR pipeline above (this is the statistically correct way to do DE on single-cell data — per-cell t-tests pseudo-replicate and inflate false positives, which is a common single-cell-tool gimmick to avoid).

### Engine H: Interval Algebra
Powers: BEDTools, BED Parser, Coverage Calculator, Read Depth Calculator, Overlap-based operations across genomics tools, Synteny Viewer (partially).

- Represent every genomic feature as `(chrom, start, end, strand, metadata)`.
- Build an **interval tree** (or a sorted-array + binary search if intervals are static) per chromosome for O(log n + k) overlap queries instead of O(n) linear scans.
- Core operations, all expressible on top of that structure: intersect, merge (union of overlapping intervals), subtract, closest-feature, window/flank, and coverage (for each position or bin, count how many intervals — i.e., reads — overlap it; implementable efficiently with a sweep-line / difference-array approach: +1 at each interval start, -1 at each interval end+1, then prefix-sum).

### Engine I: Physicochemical & Composition Calculators
Powers: GC Content, AT/GC Skew, Melting Temperature, Molecular Weight (DNA & protein), Isoelectric Point, Hydrophobicity Plot, Amino Acid Composition, Extinction Coefficient, Dilution/Buffer/Molarity/OD260 Calculators, Codon Usage/Adaptation Index.

These are the tools most likely to be built as gimmicky one-line formulas. Do them properly:
- **GC Content:** `(#G + #C) / total_length`. AT/GC Skew: `(G-C)/(G+C)` and `(A-T)/(A+T)` per window — used for real biology (origin-of-replication detection), so compute it in sliding windows, not just once globally.
- **Melting Temperature:** don't use the crude Wallace rule (`4(G+C)+2(A+T)`) as your only option — that's only valid for very short primers. Implement the **nearest-neighbor thermodynamic model (SantaLucia 1998)**: sum ΔH and ΔS for each adjacent base-pair-step using published NN parameter tables, then `Tm = ΔH / (ΔS + R·ln(C_T/4)) - 273.15`, adjusted for salt concentration (Owczarzy correction). This is what real primer-design tools (Primer3) use; a flat formula is the textbook example of a gimmick tool.
- **DNA/Protein Molecular Weight:** sum residue monoisotopic or average masses from a standard table, subtract water for each internal bond formed (n-1 waters for n residues/nucleotides linked).
- **Isoelectric Point (pI):** iteratively solve for the pH where net charge = 0, using the Henderson-Hasselbalch equation summed over each ionizable side chain (standard pKa table) plus N-/C-termini — this is a root-finding problem (bisection over pH 0–14 works fine, no closed form).
- **Hydrophobicity Plot:** slide a window across the protein, average a standard hydrophobicity scale (Kyte-Doolittle is the most common) per window, plot position vs. average — used for transmembrane region hinting.
- **Extinction Coefficient:** sum contributions of Trp, Tyr, and cystine (disulfide-bonded Cys pairs) per the Gill & von Hippel/Edelhoch method — not just protein length.
- **Codon Usage / Codon Adaptation Index:** codon usage = frequency table of each codon per amino acid across a reference gene set; CAI = geometric mean of the relative adaptiveness (codon frequency relative to the most-used synonymous codon) across all codons in a query sequence, benchmarked against a reference codon usage table (e.g., highly-expressed genes for the target organism) — real CAI needs an organism-specific reference table, not a universal constant.
- **Dilution/Buffer/Molarity/OD260:** direct application of C1V1=C2V2, Henderson-Hasselbalch for buffers, and the Beer-Lambert law (`concentration = OD260 × dilution × extinction_coefficient_of_dsDNA(50 ng·cm/µL typical)`) — simple, but make unit handling (ng/µL vs. molar, bp length dependence for molar conversion of DNA) rock solid, since unit bugs are the most common real failure mode here.

### Engine J: Restriction, Cloning & Primer Design
Powers: Restriction Site Finder, Restriction Digest Simulator, Plasmid Map, Ligation Simulator, Golden Gate Design, Gibson Assembly, Gateway Cloning, Primer Design, PCR Simulator, CRISPR Guide RNA Designer, sgRNA Off-target.

- **Restriction Site Finder:** exact/degenerate string matching (handle IUPAC ambiguity codes, e.g. `GGWCC`) across both strands, including sites that span the plasmid origin if circular (treat a circular sequence as `seq + seq[:maxSiteLen]` for search purposes).
- **Restriction Digest Simulator:** given the found cut positions (accounting for each enzyme's actual cut offset within/around its recognition site, and for 5'/3' overhangs), produce the resulting linear fragments (or, for a circular plasmid, fragments between consecutive cuts). Real fidelity also requires modeling **partial digestion** and **methylation sensitivity** if you want this to be more than a toy (many enzymes won't cut Dam/Dcm-methylated DNA).
- **Plasmid Map:** annotate a circular sequence with features (ORIs, resistance genes, promoters, restriction sites from above) at their coordinates; rendering is circular-geometry (map bp position → angle), not novel algorithm.
- **Ligation Simulator:** match compatible overhangs (sticky-end sequence complementarity, or blunt) between fragment ends, respect directionality, simulate resulting circular/linear products.
- **Golden Gate Design:** find Type IIS enzyme sites (e.g., BsaI) that cut *outside* their recognition sequence leaving a defined 4-nt overhang; the design problem is choosing/placing overhangs on each fragment so that the full set of fragments only assembles in one correct order (this is a combinatorial constraint-satisfaction problem — ensure no two junction overhangs are palindromic or duplicated elsewhere, or misassembly becomes possible).
- **Gibson Assembly:** design primers so adjacent fragments share ~20–40 bp of homology at their ends; check for unwanted secondary structure/self-complementarity in the overlap region (reuse Engine A for hairpin self-alignment) and validate melting temperature symmetry of the overlaps (reuse Engine I).
- **Gateway Cloning:** match att-site variants (attB/attP/attL/attR) by exact sequence — this is closer to a lookup/pattern-match problem than a novel algorithm.
- **Primer Design (real Primer3-style logic, not "pick 20bp and hope"):** generate candidate primer windows across the target, score/filter each candidate on: Tm (Engine I, want primer pair Tm difference < ~2°C), GC content (40–60% typical), GC clamp at 3' end, self-complementarity and hairpin formation (self-align the primer against its reverse complement via Engine A, penalize strong local alignments especially near the 3' end), primer-dimer risk between the forward/reverse pair (align primer1 against reverse-complement of primer2), and specificity (see below). Output ranked candidates, don't just return the first that passes thresholds.
- **Primer Specificity Checker:** run the candidate primer as a BLAST-like search (Engine B, short-sequence mode with lowered word size) against the target genome/transcriptome; flag if it has near-perfect matches (especially at the 3' end, which is most critical for extension) anywhere other than the intended site.
- **PCR Simulator:** given primer pair + template, find their (near-)exact match positions on both strands (Engine A/E), simulate the amplicon as the sequence between the forward primer's 5' end and the reverse primer's 5' end (on the opposite strand) — also simulate multi-round exponential amplification only if you want a quantitative yield model, otherwise the useful output is just "does it amplify, and what's the product," including checking for unintended off-target amplicons genome-wide.
- **CRISPR Guide RNA Designer:** scan the target for PAM sequences (`NGG` for SpCas9, adjust per Cas variant), extract the 20nt upstream as the candidate guide, score on-target activity with a published model (Rule Set 2 / Doench 2016 uses a regression model over sequence features — implementable as a weighted feature sum if you have the published weights; otherwise at minimum score GC content and avoid poly-T stretches which terminate Pol III transcription).
- **sgRNA Off-target:** for each candidate guide, search the genome for near-matches allowing a small number of mismatches (this is exactly an approximate string matching problem — use the FM-index from Engine E with backtracking that allows k mismatches, which is how Bowtie/Cas-OFFinder actually do it), weight mismatch positions by known Cas9 mismatch-tolerance profiles (mismatches near the PAM matter more than distal ones), and rank off-target sites by predicted cutting likelihood, not just raw mismatch count.

### Engine K: Structural Biology (3D)
Powers: PyMOL Viewer, Mol*, JSmol, AlphaFold Structure Viewer, RMSD Calculator, Structure Alignment, Pocket Detection, Ligand Interaction Viewer, Ramachandran Plot, Surface Area Calculator, Electrostatic Surface, Protein-Ligand Viewer, 3D Structure Viewer, Signal Peptide/Transmembrane/Secondary Structure/Subcellular Localization/Disulfide Bond Prediction.

- **3D Viewers (PyMOL/Mol\*/JSmol/AlphaFold viewer):** don't reimplement molecular rendering — embed the real open-source viewer libraries (Mol* / NGL / JSmol / 3Dmol.js) and feed them PDB/mmCIF coordinate data. Your "logic" here is the data pipeline (fetch from PDB/AlphaFold DB, parse coordinates, pass to the viewer), not graphics rendering.
- **RMSD Calculator:** superimpose two structures optimally before measuring — use the **Kabsch algorithm**: center both coordinate sets, compute the cross-covariance matrix, SVD it, derive the optimal rotation matrix, apply it, then `RMSD = sqrt(mean(squared distances))`. Reporting RMSD without first superimposing optimally is a classic gimmick-tool mistake.
- **Structure Alignment:** for structurally similar-but-sequence-divergent proteins, sequence-based alignment fails; use a structure-alignment algorithm (TM-align/DALI-style): iteratively align based on 3D proximity of residues (not sequence), score with a length-normalized metric like TM-score so scores are comparable across protein-size pairs.
- **Ramachandran Plot:** compute backbone dihedral angles (phi = C(i-1)-N(i)-Cα(i)-C(i), psi = N(i)-Cα(i)-C(i)-N(i+1)) from atomic coordinates for every residue, plot phi vs. psi — this is deterministic geometry, straightforward once you're parsing PDB coordinates correctly.
- **Surface Area Calculator:** Shrake-Rupley algorithm — for each atom, place points on a sphere of radius (atom radius + probe radius, typically 1.4 Å for water), count the fraction of points not buried inside any neighboring atom's sphere, sum contributions scaled by each atom's surface area. This is the standard SASA method, not something to approximate with a bounding box.
- **Pocket Detection:** grid the protein's volume, flag grid points that are inside the protein's convex hull-ish interior but not occupied by atoms and are enclosed on multiple sides (geometric pocket-finding, e.g. the approach used by fpocket via Voronoi/alpha-shapes) — real ligand-binding pocket detection is a computational geometry problem, not guesswork.
- **Electrostatic Surface:** solve the (linearized) Poisson-Boltzmann equation over a grid around the structure given atomic partial charges and radii (this is genuinely numerically heavy — in practice, wrap APBS or a similar established solver rather than writing your own PDE solver, and treat this as a legitimate "call an established scientific tool via API" case rather than a from-scratch algorithm).
- **Signal Peptide / Transmembrane / Secondary Structure prediction:** these are sequence-labeling problems, correctly solved with trained models (HMMs classically — SignalP/TMHMM are literally hidden Markov models over amino acid sequence; secondary structure prediction (PSIPRED-style) uses a neural net over a PSSM derived from a PSI-BLAST profile). Since you're excluding AI/ML-labeled tools, implement the classical HMM versions: define states (e.g., inside/TM-helix/outside for transmembrane), emission probabilities per amino acid per state from published parameter sets, transition probabilities, and run the Viterbi algorithm to get the most likely state path — this is real, non-gimmicky, and pre-dates modern ML.
- **Disulfide Bond Prediction:** find Cys residues, and for candidate pairs, score based on Cα-Cα and Sγ-Sγ distance constraints if a 3D structure is available (geometric check ~2.05 Å S-S bond length ± tolerance), or, sequence-only, flag Cys pairing patterns consistent with known motifs — be explicit that sequence-only prediction is much lower confidence than structure-based.

### Engine L: Systems Biology Networks
Powers: Cytoscape-like Network Viewer, Gene Regulatory Networks, Protein Interaction Networks, Metabolic Networks, KEGG/Reactome Viewer, GO/Pathway Enrichment.

- Represent as a standard graph: nodes (genes/proteins/metabolites) + edges (interaction type, direction, weight/confidence). Import from STRING/BioGRID (PPI), KEGG/Reactome (pathways/metabolic), or user-uploaded edge lists.
- **Viewer logic:** force-directed layout (Fruchterman-Reingold or similar physics-based layout: repulsive force between all node pairs, attractive force along edges, iterate to equilibrium) for general networks; explicit fixed coordinates for KEGG pathway maps (KEGG provides layout coordinates — use them, don't force-layout a canonical pathway diagram).
- **GO Enrichment / Pathway Enrichment:** given a gene list (e.g., DE genes from Engine G) and a background gene set, for each GO term/pathway compute a **hypergeometric test** (or Fisher's exact test — equivalent here): `P(X ≥ k) ` where k = genes in your list annotated with the term, out of K total annotated in background, drawing n = your list size from N = total background. Apply Benjamini-Hochberg correction across all tested terms (there are thousands of GO terms — uncorrected p-values here are the single most common statistical error in bioinformatics tooling). This reuses the exact same statistical primitive as Engine G's multiple-testing correction — build it once, share it.

### Engine M: Sequence/Format Comparative Genomics Metrics
Powers: Genome Alignment, Synteny Viewer, Genome Comparison, Ortholog/Paralog Finder, Pan/Core Genome Analysis, ANI Calculator.

- **Genome Alignment (whole-genome, not gene-level):** anchor-based approach — find high-scoring exact/near-exact matches (via MUMmer-style suffix-array matching, i.e. Engine E) as anchors, chain colinear anchors together (longest increasing subsequence-style chaining on anchor positions), fill gaps between anchors with local DP alignment (Engine A) only where needed. Whole-genome DP without anchoring is computationally infeasible — anchoring is the actual trick.
- **Synteny Viewer:** visualize chained anchor blocks between two genomes as connected ribbons ordered by position — purely a rendering layer over the genome alignment output above.
- **Ortholog/Paralog Finder:** classic approach is **reciprocal best BLAST hits (RBH)**: for genes A (genome 1) and B (genome 2), they're candidate orthologs if A's best BLAST hit in genome 2 is B *and* B's best hit in genome 1 is A. More rigorous: cluster-based orthology (OrthoMCL/OrthoFinder-style) — build an all-vs-all BLAST graph, normalize scores, run Markov clustering (MCL: iteratively expand (matrix power) and inflate (element-wise power + renormalize) the graph's transition matrix until it converges to a block-diagonal structure representing gene family clusters). Paralogs = genes clustering together *within* the same genome.
- **Pan/Core Genome Analysis:** cluster genes across many genomes by sequence similarity (reuse the orthology clustering above), core genome = clusters present in ~all genomes, pan genome = union of all clusters, accessory = present in some but not all.
- **ANI (Average Nucleotide Identity):** the modern, fast approach (FastANI-style) doesn't do full alignment — it fragments one genome into windows, finds best-matching windows in the other genome via k-mer/MinHash sketching (a probabilistic set-similarity technique: hash all k-mers, keep only the smallest N hashes as a compact "sketch," estimate similarity from sketch overlap — Jaccard similarity approximates sequence identity), then averages identity across matched windows. This is dramatically faster than pairwise full alignment at genome scale and is the real modern method, not a shortcut.

### Engine N: Population Genetics & Evolution
Powers: Selection Pressure, Ka/Ks, Mutation Rate, Conservation Score, Population Genetics, Linkage Disequilibrium, Haplotype Analysis.

- **Ka/Ks (dN/dS):** align coding sequences (Engine A/C, codon-aware — align at the codon level so reading frame is preserved), for every codon-pair classify each possible point mutation as synonymous or nonsynonymous to count "synonymous sites" and "nonsynonymous sites" per codon (Nei-Gojobori method), count actual observed synonymous (Sd) and nonsynonymous (Nd) differences between the sequences, `Ka = Nd/N`, `Ks = Sd/S`, ratio Ka/Ks: >1 suggests positive/diversifying selection, <1 purifying selection, ≈1 neutral. More rigorous versions (PAML-style) use maximum likelihood over a codon substitution model instead of simple counting.
- **Conservation Score:** given an MSA (Engine C), compute per-column entropy (`-Σp_i·log(p_i)` over residue frequencies) or a phylogeny-aware score (Jensen-Shannon divergence weighted by branch lengths, as in ConSurf) — phylogeny-aware scoring is more correct because it down-weights redundant near-identical sequences.
- **Population Genetics / Linkage Disequilibrium:** from genotype data across individuals, for each pair of SNPs compute haplotype frequencies (via expectation-maximization if phase is unknown), derive `D = freq(AB) - freq(A)*freq(B)`, normalize to `D'` (divide by its theoretical max given allele frequencies) or `r² = D²/(freq(A)*freq(a)*freq(B)*freq(b))`.
- **Haplotype Analysis:** phase genotypes into haplotypes (EM algorithm or reference-panel-based imputation), cluster/summarize haplotype blocks.
- **Mutation Rate:** for a phylogeny with known/calibrated divergence times, mutation rate = substitutions-per-site (from Engine D's branch lengths) divided by divergence time; for pedigree/trio data, direct counting of de novo variants per generation from variant-calling output (Engine F).

### Engine O: Metagenomics Classification
Powers: Kraken2, Kraken, Kaiju, Bracken, QIIME2, Taxonomic Classification, Microbiome Diversity, Alpha/Beta Diversity, Rarefaction.

- **Kraken/Kraken2 (k-mer based taxonomic classification):** build a database mapping every k-mer from all reference genomes to the lowest common ancestor (LCA) in a taxonomy tree of all genomes containing that k-mer. Classify a read by looking up all its k-mers, and assign the read to the taxon that is the weighted LCA of its k-mer hits (essentially a voting scheme up the taxonomy tree). This is exact k-mer matching (hash table lookup), not alignment — that's why it's fast enough for metagenomic scale.
- **Kaiju:** same idea but on translated protein space using an FM-index (Engine E) with a maximum-exact-match search, better for divergent/novel organisms since protein sequence is more conserved than DNA.
- **Bracken:** takes Kraken's read classifications (which get stuck at higher taxonomy levels for ambiguous reads) and re-estimates abundance at species level using a Bayesian re-distribution based on genome-length-and-similarity-derived redistribution probabilities.
- **QIIME2-style pipeline:** amplicon (16S) workflow — quality filter reads, denoise (DADA2-style: model per-base error rates from quality scores, cluster reads into exact "amplicon sequence variants" by an error-aware probabilistic model, rather than the older, cruder fixed-similarity-threshold OTU clustering), classify ASVs taxonomically (Naive Bayes classifier trained on a reference database, or exact/near-exact matching against reference), then diversity analysis below.
- **Alpha Diversity:** per-sample metric over the abundance table — Shannon index `-Σp_i·ln(p_i)`, Simpson index `1-Σp_i²`, or simple observed-species richness.
- **Beta Diversity:** between-sample dissimilarity — Bray-Curtis (`Σ|x_i-y_i| / Σ(x_i+y_i)`) for abundance, or UniFrac (phylogeny-aware: weight shared/unshared branch length between samples' taxa on a reference tree) for a more biologically meaningful distance.
- **Rarefaction:** subsample each sample's reads down to a common depth (without replacement) multiple times, recompute richness/alpha-diversity at each subsampled depth, plot depth vs. diversity to check whether sequencing depth was sufficient to capture the community's true diversity.

### Engine P: Set Operations (List Comparison Tools)
Powers: all of Section 15 (Compare Lists 2–5, Common/Unique Genes, Union/Intersection/Difference/Symmetric Difference, Duplicate Finder, Gene Matching, Gene ID Converter, Venn Diagrams 2–5, UpSet Plot).

This section looks big but is entirely one primitive plus one UI decision:
- Normalize each input list to a canonical gene identifier (see Gene ID Converter below — this normalization step is actually the *hard* and important part; the set math itself is trivial).
- Represent each list as a hash set. Then: Union = `A∪B`, Intersection = `A∩B`, Difference = `A−B`, Symmetric Difference = `A⊕B`, all O(n) with hash sets — no algorithmic subtlety here at all.
- Duplicate Finder / Remove Duplicates: hash-set membership check while iterating.
- Venn Diagram (2–5 sets): compute the size of every combination of set-membership regions (`2^n - 1` regions for n sets), render as a geometric Venn (for n≤3 use true proportional circles; for 4–5 sets true-to-scale circles are mathematically impossible to draw for arbitrary values — use ellipse-based Venn layouts (standard 4/5-set templates) which are topologically correct but not area-proportional; be honest about this rather than faking proportionality).
- **UpSet Plot:** for >3 sets, this is genuinely the better visualization than Venn — it's a matrix (rows = each individual set, columns = every combination that actually has ≥1 member) with a connected-dot indicator per column and a bar chart of each combination's size above; UpSet's advantage is that it scales to many sets without becoming visually unreadable, unlike 5-way Venn diagrams.
- **Gene ID Converter / Batch Gene Converter / Gene Name Cleaner:** this is a lookup problem against a cross-reference table (e.g., HGNC/NCBI Gene/Ensembl mapping symbol ↔ Entrez ID ↔ Ensembl ID ↔ UniProt, and mapping deprecated/alias symbols to current approved symbols). The "logic" is maintaining an up-to-date mapping table and handling many-to-many cases (one symbol can map to multiple IDs across species/versions) explicitly rather than silently picking one.
- **Missing Gene Finder:** set difference between an expected reference list and the input list — again pure set math, made non-trivial only by ID normalization.

### Engine Q: Format-Conversion & Parsing (see also Part 3)
Powers: Section 17 in full, and all *-to-* utilities scattered through Sections 2–3.

Not "an algorithm" so much as: implement a strict parser and strict writer for each format's actual specification (not a regex hack), validate round-trip integrity, and handle the edge cases each format is notorious for (see Part 3 for specifics per format). This is where most amateur tools silently corrupt data — e.g., mishandling BAM's binary/compressed block structure, or losing GFF's 1-based-inclusive vs BED's 0-based-half-open coordinate difference during conversion.

### Engine R: Rosalind-style Discrete Algorithms
Powers: Section 16 — this section is explicitly pedagogical, and its value is in *implementing the textbook algorithm correctly*, not in production performance:
- DNA/RNA Count, GC Content, Reverse Complement, Consensus String: direct application of Engines already above (I, string ops).
- **Overlap Graph:** described in Engine E.
- **Longest Common Subsequence:** classic O(n·m) DP, `L[i][j] = L[i-1][j-1]+1` if chars match else `max(L[i-1][j], L[i][j-1])`.
- **Longest Increasing Subsequence:** O(n log n) with patience sorting (maintain a list of smallest tail values for each LIS length, binary search to place each new element).
- **Splicing:** remove intron substrings from a sequence given exon/intron coordinates or given intron sequences to find-and-remove.
- **Eulerian Cycle/Path:** Hierholzer's algorithm (already noted in Engine F).
- **Trie / Suffix Tree / Suffix Array / BWT:** Engine E, exactly.
- **Hidden Markov Models:** implement the three classic HMM algorithms generically (forward algorithm for sequence probability, Viterbi for most likely state path, Baum-Welch/EM for parameter training) — this generic HMM engine is also what powers Engine K's signal-peptide/TM prediction, so build it once and reuse it.
- **Mass Spectrometry Problems:** given a protein/peptide, compute theoretical fragment ion masses (b-ions and y-ions from peptide bond cleavage) and solve inverse problems like peptide sequencing from a spectrum via graph-based spectral alignment.
- **Probability/Combinatorics:** direct formula implementations (permutations, combinations, Bayesian probability calculations) — genuinely just correct math, no trick.

---

## PART 2 — MAPPING REMAINING CATEGORIES

Most categories above are already fully covered by the engines. A few items need a category-specific note:

**Section 5/6 remainder (Domain Finder, Motif Finder, Signal Peptide, etc.):**
- **Domain Finder / Pfam / SMART / CDD / InterPro Scan:** all of these are **profile HMM search** against a curated domain database (Pfam is literally a library of profile HMMs). Use Engine R's HMM machinery: build/load a profile HMM per domain family, run the forward algorithm (or the specialized HMMER pipeline) against the query, report domains scoring above a calibrated bit-score/E-value threshold. Don't substitute simple motif regexes for this and call it "domain finding" — regex motif search is a different, weaker tool (that's what plain "Motif Finder" should honestly be: PROSITE-style regex/consensus pattern matching, distinct from profile-HMM domain finding).
- **UniProt/SwissProt Search, Protein Family Search:** these are essentially search-index lookups (full-text + field search) against mirrored/queried UniProt data via their REST API — wrap the real UniProt API rather than reimplementing their database.
- **Subcellular Localization:** classically a trained classifier (e.g., k-NN or SVM in older tools like PSORT) over computed features — amino acid composition (Engine I), presence of a predicted signal peptide (Engine K's HMM), presence of specific sorting motifs (regex/motif search). Since ML models are out of scope here, implement it as a transparent rule/feature-scoring system based on these classical features and document that it's a heuristic, not a black box.

**Section 4 Tree Viewer/Editor/Comparison/Annotation/Circular Tree:** fully covered by Engine D's "rendering vs. algorithm" split — Robinson-Foulds for comparison, standard tree layout algorithms (rectangular cladogram coordinates computed recursively by subtree depth/leaf-count; circular = same recursive layout mapped from Cartesian to polar coordinates) for viewer/circular tree.

**Section 20 — Workflow & Reproducibility:**
- **Workflow builder (Galaxy-style):** represent a pipeline as a **DAG (directed acyclic graph)** of tool nodes with typed input/output ports; validate the DAG has no cycles (topological sort — Kahn's algorithm) and that connected ports have compatible data types before allowing execution.
- **Job queue with resumable analyses:** each DAG node execution is a job; track job state (pending/running/done/failed) and content-hash each node's inputs+parameters so identical steps can be skipped on re-run (this cache-by-hash approach is exactly what Nextflow/Snakemake do — it's the real mechanism behind "resumability," not a vague checkpoint).
- **Cloud execution (Docker/Nextflow/Snakemake):** don't reimplement these — shell out to the real engines, containerize each tool from the engines above so every "tool" in your suite is independently reproducible and versioned.
- **Provenance tracking:** log, per job, the exact tool version, parameters, input file hashes, and output file hashes — this is what makes a result scientifically reproducible/auditable, not just a changelog.
- **Notebook integration:** expose a thin Python/R client library that calls your REST API (Part 4) so users can call the same tools from Jupyter/RStudio instead of the web UI — same backend, different client.

---

## PART 3 — FILE FORMAT PARSERS (the unglamorous backbone)

Build one strict parser + writer per format. Key gotchas that separate a real parser from a broken one:

- **FASTA:** header line `>id description`, sequence may be wrapped across multiple lines — always concatenate wrapped lines before treating a record as complete.
- **FASTQ:** 4-line records (`@id`, sequence, `+`, quality). Quality is ASCII-encoded (Phred+33 standard now, but old Illumina used Phred+64 — detect/handle both). Never assume sequence and quality lines aren't wrapped (they can be in some FASTQ variants) — validate lengths match.
- **GenBank/EMBL:** flat-file with a `FEATURES` table (location strings like `complement(join(1..50,100..150))` describing spliced/reverse-strand features — you need a real location-string parser, not string-splitting) plus the sequence at the bottom (`ORIGIN`).
- **SAM/BAM:** SAM is tab-delimited text; BAM is the same data BGZF-compressed (block gzip — seekable, unlike normal gzip) with a binary encoding — use an existing library (htslib bindings) rather than hand-rolling BAM binary parsing. CRAM adds reference-based compression on top.
- **VCF:** header (`##` meta-lines defining INFO/FORMAT field types — parse these to know how to interpret each column, don't hardcode field meanings), then tab-delimited records; genotype fields are colon-delimited per the FORMAT column's field order, which can vary line to line.
- **GFF/GTF:** 1-based, **inclusive** coordinates. Attributes column format differs between GFF3 (`key=value;key2=value2`) and GTF (`key "value"; key2 "value2";`) — these are not interchangeable without an explicit converter.
- **BED:** 0-based, **half-open** coordinates (`start` inclusive, `end` exclusive) — this is the single most common bug when converting BED↔GFF: off-by-one errors. Always convert explicitly (`GFF_start = BED_start + 1`, `GFF_end = BED_end`).
- **PDB/mmCIF:** PDB is fixed-column-width text (parse by character position, not whitespace-split, since some fields touch); mmCIF is a more structured, extensible key-value/table format — prefer mmCIF for anything modern since PDB's fixed-width format breaks on large structures (>99999 atoms, 4-character chain IDs, etc.).
- **Newick/Nexus:** Newick is a recursive parenthetical grammar (`(A:0.1,(B:0.2,C:0.3):0.15);`) — parse it recursively (a stack-based or recursive-descent parser, not regex). Nexus wraps Newick (and other data) in labeled blocks (`BEGIN TREES; ... END;`).

---

## PART 4 — API / ARCHITECTURE PATTERN

Keep every tool's endpoint thin and push shared logic into the engines:

```
/api/align/{pairwise|msa|blast}
/api/phylo/{tree-build|bootstrap|compare}
/api/genomics/{align-reads|call-variants|interval-ops}
/api/expression/{normalize|differential|pca|cluster}
/api/sequence/{composition|restriction|primer-design|crispr-design}
/api/structure/{rmsd|sasa|pocket|dihedral}
/api/comparative/{ortholog|ani|synteny}
/api/metagenomics/{classify|diversity}
/api/sets/{operate|convert-ids}
/api/convert/{format-pair}
/api/workflow/{dag|run|status}
```

- Long-running jobs (BLAST searches, read alignment, assembly, workflows) should be **async**: `POST` returns a job ID immediately, client polls `GET /api/jobs/{id}` or subscribes via websocket — don't hold an HTTP connection open for a 20-minute genome alignment.
- Validate and sanitize sequence input at the boundary (reject/flag non-IUPAC characters, enforce length limits per endpoint) before it reaches any engine — malformed input is the most common real-world crash source.
- Version your reference databases and scoring matrices explicitly in every response's metadata (BLOSUM62 vs 45, which genome build, which Pfam release) — reproducibility depends on knowing exactly which reference data produced a given result.

---

## What makes this "not a gimmick," summarized

A gimmick version of this suite would: use ad-hoc formulas instead of published algorithms (flat Tm formula instead of nearest-neighbor thermodynamics), skip statistical correction (raw p-values on thousands of genes/GO terms), skip proper normalization (comparing raw read counts across samples), fake proportional Venn diagrams past 3 sets, do naive O(n²) all-pairs comparison where genome-scale data requires indexing (suffix arrays/FM-index/k-mer sketching), and treat visualization tools as if the rendering *is* the science rather than a display of correctly-computed upstream data. Building the ~18 engines above properly, once, and wiring every named tool to the right one is what makes the other ~280 tools legitimate rather than cosmetic.
