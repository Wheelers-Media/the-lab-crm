import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

type Row = { name: string; sales: number | null };
const columns = [
  { label: "Product", value: (r: Row) => r.name },
  { label: "Sales", value: (r: Row) => r.sales },
];

describe("toCsv", () => {
  it("writes a header and one line per row", () => {
    expect(toCsv([{ name: "Tint", sales: 120.5 }], columns)).toBe(
      "Product,Sales\r\nTint,120.5",
    );
  });

  it("quotes commas, quotes and line breaks", () => {
    const csv = toCsv(
      [{ name: 'Muffler, 4" "Polar"\nkit', sales: 1 }],
      columns,
    );

    expect(csv).toBe('Product,Sales\r\n"Muffler, 4"" ""Polar""\nkit",1');
  });

  it("stops a product name from running as a spreadsheet formula, but keeps negative numbers", () => {
    const csv = toCsv([{ name: '=HYPERLINK("x")', sales: -5 }], columns);

    expect(csv).toBe('Product,Sales\r\n"\'=HYPERLINK(""x"")",-5');
  });

  it("leaves empty values blank", () => {
    expect(toCsv([{ name: "Tint", sales: null }], columns)).toBe(
      "Product,Sales\r\nTint,",
    );
  });
});
