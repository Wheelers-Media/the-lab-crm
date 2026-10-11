// Plain CSV for the tables on the Numbers screen, to open in a spreadsheet.

export type CsvValue = string | number | null | undefined;

export interface CsvColumn<T> {
  label: string;
  value: (row: T) => CsvValue;
}

// A cell starting with one of these is read as a formula by Excel and Sheets:
// product names come from Shopify, so they are neutralised
const FORMULA_START = /^[=+\-@\t\r]/;

const cell = (value: CsvValue): string => {
  if (value == null) return "";
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "";
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = <T>(rows: T[], columns: Array<CsvColumn<T>>): string =>
  [
    columns.map((c) => cell(c.label)).join(","),
    ...rows.map((row) => columns.map((c) => cell(c.value(row))).join(",")),
  ].join("\r\n");

/** Saves text as a file from the browser. */
export const downloadCsv = (filename: string, csv: string): void => {
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
