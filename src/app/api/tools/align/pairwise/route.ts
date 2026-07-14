import { fail, guardSeq, ok, readBody } from "@/lib/bio/api";
import { pairwiseAlign, type AlignMode } from "@/lib/bio/alignment";

export async function POST(req: Request) {
  const [body, err] = await readBody<{
    seq1: string;
    seq2: string;
    mode?: AlignMode;
    matrix?: "blosum62" | "identity";
    gapOpen?: number;
    gapExtend?: number;
  }>(req);
  if (err) return err;
  const e1 = guardSeq(body?.seq1, "seq1");
  const e2 = guardSeq(body?.seq2, "seq2");
  if (e1 || e2 || !body) return fail(e1 ?? e2 ?? "Missing sequences.");

  if (body.seq1.length * body.seq2.length > 4_000_000) {
    return fail("Sequences too large for interactive alignment (max ~2000×2000).");
  }

  return ok(
    pairwiseAlign({
      seq1: body.seq1,
      seq2: body.seq2,
      mode: body.mode ?? "global",
      matrix: body.matrix ?? "identity",
      gapOpen: body.gapOpen ?? -10,
      gapExtend: body.gapExtend ?? -1
    })
  );
}
