import { fail, guardSeq, ok, readBody } from "@/lib/bio/api";
import { findOrfs, sixFrameTranslation, translate } from "@/lib/bio/codons";

export async function POST(req: Request) {
  const [body, err] = await readBody<{ sequence: string; frame?: number; minOrf?: number }>(req);
  if (err) return err;
  const seqError = guardSeq(body?.sequence);
  if (seqError || !body) return fail(seqError ?? "Missing sequence.");

  const minOrf = Math.min(Math.max(body.minOrf ?? 30, 1), 5000);
  return ok({
    primary: translate(body.sequence, body.frame ?? 0),
    sixFrame: sixFrameTranslation(body.sequence),
    orfs: findOrfs(body.sequence, minOrf).slice(0, 50)
  });
}
