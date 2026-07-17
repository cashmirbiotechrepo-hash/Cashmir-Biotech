import "server-only";

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

import { gzipSync } from "zlib";

/** Wrap CSV text in a downloadable Response. */
export function csvResponse(csv: string, filename: string): Response {
  const stamped = filename.replace("{date}", new Date().toISOString().slice(0, 10));
  // PROJECT OMEGA / TOP-100 #20 FIX: Enforce explicit compression headers on large CSV exports
  const compressed = gzipSync(Buffer.from(csv, 'utf-8'));
  return new Response(compressed, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${stamped}"`,
      "Content-Encoding": "gzip",
      "Cache-Control": "no-store"
    }
  });
}
