import { fail, guardSeq, ok, readBody } from "@/lib/bio/api";
import { hydrophobicityProfile, proteinProperties } from "@/lib/bio/physicochem";

export async function POST(req: Request) {
  const [body, err] = await readBody<{ sequence: string; window?: number }>(req);
  if (err) return err;
  const seqError = guardSeq(body?.sequence);
  if (seqError || !body) return fail(seqError ?? "Missing sequence.");

  const window = Math.min(Math.max(body.window ?? 9, 3), 51);
  return ok({
    ...proteinProperties(body.sequence),
    hydrophobicity: hydrophobicityProfile(body.sequence, window)
  });
}
