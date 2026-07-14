"use client";

type Json = unknown;

function isRecord(v: unknown): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function formatValue(v: Json): string {
  if (typeof v === "number") return Number.isInteger(v) ? v.toString() : v.toString();
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

function humanize(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bPct\b/i, "%");
}

/** Alignment block (monospace, chunked) when the shape matches Engine A output. */
function AlignmentBlock({ data }: { data: Record<string, Json> }) {
  const a = String(data.alignedSeq1);
  const mid = String(data.midline);
  const b = String(data.alignedSeq2);
  const width = 60;
  const rows: string[] = [];
  for (let i = 0; i < a.length; i += width) {
    rows.push(
      `Q  ${a.slice(i, i + width)}\n   ${mid.slice(i, i + width)}\nS  ${b.slice(i, i + width)}`
    );
  }
  return (
    <pre className="overflow-x-auto rounded-xl border border-ink/10 bg-ink/[0.03] p-4 font-mono text-[12px] leading-relaxed text-ink">
      {rows.join("\n\n")}
    </pre>
  );
}

function StatGrid({ entries }: { entries: [string, Json][] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-xl border border-ink/10 bg-paper/60 p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">{humanize(k)}</p>
          <p className="mt-1 text-lg font-light tracking-tight text-ink">{formatValue(v)}</p>
        </div>
      ))}
    </div>
  );
}

function Table({ rows }: { rows: Record<string, Json>[] }) {
  if (rows.length === 0) return null;
  const cols = Object.keys(rows[0]).filter((c) => !isRecord(rows[0][c]) && !Array.isArray(rows[0][c]));
  return (
    <div className="overflow-x-auto rounded-xl border border-ink/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink/[0.03]">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                {humanize(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((row, i) => (
            <tr key={i} className="border-t border-ink/8">
              {cols.map((c) => (
                <td key={c} className="px-4 py-2 font-mono text-[12px] text-ink-soft">
                  {formatValue(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A single BLAST HSP rendered like a classic pairwise report. */
function BlastHitCard({ hit }: { hit: Record<string, Json> }) {
  const q = String(hit.queryAlignment);
  const mid = String(hit.midline);
  const s = String(hit.subjectAlignment);
  const width = 60;
  const qStart = Number(hit.queryStart);
  const sStart = Number(hit.subjectStart);
  const qStep = hit.queryStrand === "-" ? -1 : 1;

  let qCursor = qStart;
  let sCursor = sStart;
  const rows: string[] = [];
  for (let i = 0; i < q.length; i += width) {
    const qSlice = q.slice(i, i + width);
    const sSlice = s.slice(i, i + width);
    const qResidues = (qSlice.match(/[^-]/g) || []).length;
    const sResidues = (sSlice.match(/[^-]/g) || []).length;
    const qEnd = qCursor + qStep * (qResidues > 0 ? qResidues - 1 : 0);
    const sEnd = sCursor + (sResidues > 0 ? sResidues - 1 : 0);
    const pad = (n: number) => String(n).padStart(6, " ");
    rows.push(
      `Query ${pad(qCursor)}  ${qSlice}  ${qEnd}\n              ${mid.slice(i, i + width)}\nSbjct ${pad(sCursor)}  ${sSlice}  ${sEnd}`
    );
    qCursor = qEnd + qStep;
    sCursor = sEnd + 1;
  }

  const meta: [string, string][] = [
    ["Score", `${hit.bitScore} bits (${hit.score})`],
    ["Expect", String(hit.eValueText ?? hit.eValue)],
    ["Identities", `${hit.identity}/${hit.alignmentLength} (${hit.identityPct}%)`],
    ["Positives", `${hit.positives}/${hit.alignmentLength} (${hit.positivesPct}%)`],
    ["Gaps", `${hit.gaps}/${hit.alignmentLength}`]
  ];
  if (hit.queryFrame !== 0 || hit.subjectFrame !== 0) {
    meta.push(["Frame", `Q ${hit.queryStrand}${hit.queryFrame} / S ${hit.subjectFrame}`]);
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-paper/50 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-sm text-ink">
          {String(hit.subjectId)}
          {hit.subjectDef ? <span className="text-ink-mute"> {String(hit.subjectDef)}</span> : null}
        </p>
        <p className="font-mono text-[11px] text-gold">E = {String(hit.eValueText ?? hit.eValue)}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
        {meta.map(([k, v]) => (
          <span key={k} className="font-mono text-[11px] text-ink-soft">
            <span className="text-ink-faint">{k}:</span> {v}
          </span>
        ))}
      </div>
      <pre className="mt-4 overflow-x-auto rounded-xl border border-ink/10 bg-ink/[0.03] p-4 font-mono text-[12px] leading-relaxed text-ink">
        {rows.join("\n\n")}
      </pre>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-gold">{title}</p>
      {children}
    </div>
  );
}

export function ToolResult({ data }: { data: Json }) {
  if (!isRecord(data)) {
    return (
      <pre className="overflow-x-auto rounded-xl border border-ink/10 bg-paper/60 p-4 font-mono text-xs text-ink">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }

  // BLAST-shaped result: render HSP cards instead of a wide scalar table.
  const hitsRaw = data.hits;
  const isBlast =
    Array.isArray(hitsRaw) && (hitsRaw.length === 0 || (isRecord(hitsRaw[0]) && "queryAlignment" in hitsRaw[0]));
  if (isBlast) {
    const hits = hitsRaw as Record<string, Json>[];
    const stats = isRecord(data.statistics) ? data.statistics : null;
    return (
      <div className="space-y-7">
        <Section title="Search summary">
          <StatGrid
            entries={[
              ["program", data.program],
              ["matrix", data.matrix],
              ["wordSize", data.wordSize],
              ["hits", hits.length],
              ...(stats
                ? (Object.entries(stats).filter(
                    ([, v]) => typeof v === "number" || typeof v === "string" || typeof v === "boolean"
                  ) as [string, Json][])
                : [])
            ]}
          />
        </Section>
        {hits.length === 0 ? (
          <p className="rounded-xl border border-ink/10 bg-paper/60 p-4 font-mono text-[12px] text-ink-soft">
            No significant hits found below the E-value cutoff.
          </p>
        ) : (
          <Section title={`Alignments (${hits.length})`}>
            <div className="space-y-4">
              {hits.map((hit, i) => (
                <BlastHitCard key={i} hit={hit} />
              ))}
            </div>
          </Section>
        )}
      </div>
    );
  }

  const scalarEntries: [string, Json][] = [];
  const stringEntries: [string, Json][] = [];
  const arrayEntries: [string, Json[]][] = [];

  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "number" || typeof v === "boolean") scalarEntries.push([k, v]);
    else if (typeof v === "string") stringEntries.push([k, v]);
    else if (Array.isArray(v)) arrayEntries.push([k, v]);
  }

  const isAlignment = "alignedSeq1" in data && "midline" in data;

  return (
    <div className="space-y-7">
      {isAlignment ? (
        <Section title="Alignment">
          <AlignmentBlock data={data} />
        </Section>
      ) : null}

      {scalarEntries.length > 0 ? (
        <Section title="Metrics">
          <StatGrid entries={scalarEntries} />
        </Section>
      ) : null}

      {stringEntries
        .filter(([k]) => !["alignedSeq1", "alignedSeq2", "midline"].includes(k))
        .map(([k, v]) => (
          <Section key={k} title={humanize(k)}>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-ink/10 bg-ink/[0.03] p-4 font-mono text-[12px] leading-relaxed text-ink">
              {String(v)}
            </pre>
          </Section>
        ))}

      {arrayEntries.map(([k, arr]) => {
        if (arr.length === 0) return null;
        if (isRecord(arr[0])) {
          return (
            <Section key={k} title={`${humanize(k)} (${arr.length})`}>
              <Table rows={arr as Record<string, Json>[]} />
            </Section>
          );
        }
        return (
          <Section key={k} title={`${humanize(k)} (${arr.length})`}>
            <p className="font-mono text-[12px] text-ink-soft">{arr.map(formatValue).join(", ")}</p>
          </Section>
        );
      })}
    </div>
  );
}
