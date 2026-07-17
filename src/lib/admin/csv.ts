import "server-only";
import { gzipSync } from "zlib";

/**
 * Escape a CSV cell and neutralize spreadsheet formula injection.
 * Leading = + - @ tab CR are prefixed with a single quote so Excel/Sheets
 * treat the value as text (OWASP CSV Injection).
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a CSV string from a header row and data rows. */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }
  return lines.join("\n");
}

/** Wrap a fully-buffered CSV string in a gzipped downloadable Response. */
export function csvResponse(csv: string, filename: string): Response {
  const stamped = filename.replace("{date}", new Date().toISOString().slice(0, 10));
  const compressed = gzipSync(Buffer.from(csv, "utf-8"));
  return new Response(compressed, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${stamped}"`,
      "Content-Encoding": "gzip",
      "Cache-Control": "no-store"
    }
  });
}

/**
 * Stream a CSV download without loading the full dataset into memory.
 * Prefer this for admin exports that can grow unbounded over time.
 */
export function streamCsvResponse(
  filename: string,
  header: string[],
  rows: AsyncIterable<unknown[]>
): Response {
  const stamped = filename.replace("{date}", new Date().toISOString().slice(0, 10));
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`${header.map(csvCell).join(",")}\n`));
        for await (const row of rows) {
          controller.enqueue(encoder.encode(`${row.map(csvCell).join(",")}\n`));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${stamped}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

/** Cursor-paginated Prisma findMany helper used by streaming CSV exporters. */
export async function* cursorPages<T extends { id: string }>(
  fetchPage: (args: { cursor?: string; take: number }) => Promise<T[]>,
  pageSize = 1000
): AsyncGenerator<T> {
  let cursor: string | undefined;
  for (;;) {
    const page = await fetchPage({ cursor, take: pageSize });
    if (page.length === 0) return;
    for (const row of page) yield row;
    if (page.length < pageSize) return;
    cursor = page[page.length - 1]!.id;
  }
}
