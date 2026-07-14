import { fail, guardSeq, ok, readBody } from "@/lib/bio/api";
import { cleanSequence, complement, reverseComplement, transcribe } from "@/lib/bio/sequences";

export async function POST(req: Request) {
  const [body, err] = await readBody<{ sequence: string }>(req);
  if (err) return err;
  const seqError = guardSeq(body?.sequence);
  if (seqError || !body) return fail(seqError ?? "Missing sequence.");

  const clean = cleanSequence(body.sequence);
  return ok({
    input: clean,
    length: clean.length,
    complement: complement(clean),
    reverseComplement: reverseComplement(clean),
    reverse: [...clean].reverse().join(""),
    transcript: transcribe(clean)
  });
}
