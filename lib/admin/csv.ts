/**
 * CSV generation.
 *
 * Two things this gets right that hand-rolled CSV usually does not:
 *  - values are quoted and internal quotes doubled, so a department name with a
 *    comma cannot shift every following column;
 *  - a leading =, +, - or @ is prefixed with an apostrophe, so a value can never
 *    be interpreted as a formula when the export is opened in Excel.
 */

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = value instanceof Date ? value.toISOString() : String(value);

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function csvRow(values: unknown[]): string {
  return `${values.map(escapeCsvValue).join(",")}\r\n`;
}

export function csvDocument(headers: string[], rows: unknown[][]): string {
  return [csvRow(headers), ...rows.map(csvRow)].join("");
}

/** Filename with a timestamp, so successive exports do not overwrite each other. */
export function exportFilename(prefix: string, extension = "csv"): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${prefix}-${stamp}.${extension}`;
}
