import { fail, guardSeq, MAX_SEQ_LENGTH, ok, readBody } from "@/lib/bio/api";
import { blast, type BlastProgram } from "@/lib/bio/blast";

const PROGRAMS: BlastProgram[] = ["blastn", "blastp", "blastx", "tblastn", "tblastx"];

export async function POST(req: Request) {
  const [body, err] = await readBody<{
    query: string;
    database: string;
    program?: BlastProgram;
    evalue?: number;
    wordSize?: number;
    maxHits?: number;
  }>(req);
  if (err) return err;
  if (!body) return fail("Missing body.");

  const qErr = guardSeq(body.query, "query");
  if (qErr) return fail(qErr);
  if (typeof body.database !== "string" || body.database.trim().length === 0) {
    return fail("Missing database (paste one or more FASTA sequences to search).");
  }
  if (body.database.length > MAX_SEQ_LENGTH * 2) {
    return fail("Database too large for interactive search.");
  }
  const program = body.program && PROGRAMS.includes(body.program) ? body.program : "blastn";
  if (body.query.length > 10_000) return fail("Query too long for interactive BLAST (max 10,000).");

  const result = blast({
    query: body.query,
    database: body.database,
    program,
    evalue: body.evalue ?? 10,
    wordSize: body.wordSize,
    maxHits: body.maxHits ?? 50
  });

  return ok(result);
}
