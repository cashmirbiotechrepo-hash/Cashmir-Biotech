import { fail, guardSeq, ok, readBody } from "@/lib/bio/api";
import { digest, ENZYMES, findSites } from "@/lib/bio/restriction";

export async function POST(req: Request) {
  const [body, err] = await readBody<{
    sequence: string;
    enzymes?: string[];
    circular?: boolean;
  }>(req);
  if (err) return err;
  const seqError = guardSeq(body?.sequence);
  if (seqError || !body) return fail(seqError ?? "Missing sequence.");

  const enzymes = Array.isArray(body.enzymes) ? body.enzymes : undefined;
  const circular = Boolean(body.circular);
  const sites = findSites(body.sequence, enzymes, circular);
  const digestResult = digest(body.sequence, enzymes ?? ENZYMES.map((e) => e.name), circular);

  return ok({
    availableEnzymes: ENZYMES.map((e) => ({ name: e.name, site: e.site })),
    siteCount: sites.length,
    sites: sites.slice(0, 500),
    ...digestResult
  });
}
