import { fail, guardSeq, ok, readBody } from "@/lib/bio/api";
import { dnaMolecularWeight, meltingTemperature } from "@/lib/bio/physicochem";

export async function POST(req: Request) {
  const [body, err] = await readBody<{ sequence: string; primerConc?: number; sodium?: number }>(req);
  if (err) return err;
  const seqError = guardSeq(body?.sequence);
  if (seqError || !body) return fail(seqError ?? "Missing sequence.");

  const tm = meltingTemperature(body.sequence, body.primerConc ?? 500, body.sodium ?? 50);
  return ok({
    ...tm,
    molecularWeightSs: dnaMolecularWeight(body.sequence, "ss"),
    molecularWeightDs: dnaMolecularWeight(body.sequence, "ds")
  });
}
