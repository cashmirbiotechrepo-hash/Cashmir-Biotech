import { fail, guardSeq, ok, readBody } from "@/lib/bio/api";
import { baseComposition, validate, windowedGc, type MoleculeType } from "@/lib/bio/sequences";

export async function POST(req: Request) {
  const [body, err] = await readBody<{ sequence: string; type?: MoleculeType; window?: number }>(req);
  if (err) return err;
  const seqError = guardSeq(body?.sequence);
  if (seqError || !body) return fail(seqError ?? "Missing sequence.");

  const type = body.type ?? "dna";
  const comp = baseComposition(body.sequence);
  const validation = validate(comp.length ? Object.keys(comp.counts).join("") : "", type);
  const window = Math.min(Math.max(body.window ?? 100, 10), 5000);

  return ok({
    ...comp,
    gcContentPct: Math.round(comp.gcContent * 1000) / 10,
    atContentPct: Math.round(comp.atContent * 1000) / 10,
    validation,
    windowedGc: comp.length >= window ? windowedGc(body.sequence, window, Math.max(1, Math.floor(window / 2))) : []
  });
}
