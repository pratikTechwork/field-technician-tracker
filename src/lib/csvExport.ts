function escapeCsvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToLine(row: unknown[]): string {
  return row.map(escapeCsvCell).join(",");
}

export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  return [rowToLine(headers), ...rows.map(rowToLine)].join("\r\n");
}

export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadTableCsv(
  filename: string,
  headers: string[],
  rows: unknown[][]
): void {
  downloadCsvFile(filename, rowsToCsv(headers, rows));
}

/** Multiple header + row blocks separated by a blank line (no titles or filter meta). */
export function downloadTablesCsv(
  filename: string,
  tables: { headers: string[]; rows: unknown[][] }[]
): void {
  const content = tables.map((t) => rowsToCsv(t.headers, t.rows)).join("\r\n\r\n");
  downloadCsvFile(filename, content);
}
