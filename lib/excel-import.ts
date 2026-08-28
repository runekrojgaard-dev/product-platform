import * as XLSX from "xlsx";

export type ParsedProjectRow = {
  rowNumber: number;
  projectName: string;
  customerName: string;
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  /** Present only if the row includes Product Number + Product Name + Category. */
  product: { productNumber: string; productName: string; category: string } | null;
};

export type ParseResult = {
  rows: ParsedProjectRow[];
  errors: { rowNumber: number; message: string }[];
};

const STATUS_MAP: Record<string, ParsedProjectRow["status"]> = {
  active: "ACTIVE",
  "on hold": "ON_HOLD",
  onhold: "ON_HOLD",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
};

/**
 * Expects a worksheet with header row: "Project Name", "Customer", "Status"
 * (Status is optional, defaults to Active). Column names are matched
 * case-insensitively with whitespace trimmed, so "project name" or
 * " Customer " also work — spreadsheet headers are rarely pixel-perfect.
 *
 * Optionally also: "Product Number", "Product Name", "Category" — if any
 * one of these three is filled in on a row, all three must be, and a
 * Product is created under that row's project. Any image pasted directly
 * into that row's cells (see excel-image-extract.ts) is attached to the
 * created product as a reference photo.
 */
export function parseProjectsWorkbook(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { rows: [], errors: [{ rowNumber: 0, message: "The file has no sheets" }] };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const rows: ParsedProjectRow[] = [];
  const errors: { rowNumber: number; message: string }[] = [];

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2; // +2: 1-indexed, plus the header row itself
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(raw)) {
      normalized[key.trim().toLowerCase()] = raw[key];
    }

    const projectName = String(normalized["project name"] ?? "").trim();
    const customerName = String(normalized["customer"] ?? "").trim();
    const statusRaw = String(normalized["status"] ?? "").trim().toLowerCase();
    const productNumber = String(normalized["product number"] ?? "").trim();
    const productName = String(normalized["product name"] ?? "").trim();
    const category = String(normalized["category"] ?? "").trim();

    if (!projectName || !customerName) {
      errors.push({
        rowNumber,
        message: "Missing required 'Project Name' or 'Customer' value",
      });
      return;
    }

    // Product columns are all-or-nothing: if any one of them is filled in,
    // treat it as an attempted product row and require all three, rather
    // than silently creating a half-specified product.
    const anyProductField = productNumber || productName || category;
    if (anyProductField && (!productNumber || !productName || !category)) {
      errors.push({
        rowNumber,
        message:
          "Partial product info — 'Product Number', 'Product Name', and 'Category' must all be filled in together",
      });
      return;
    }

    rows.push({
      rowNumber,
      projectName,
      customerName,
      status: STATUS_MAP[statusRaw] ?? "ACTIVE",
      product: anyProductField ? { productNumber, productName, category } : null,
    });
  });

  return { rows, errors };
}
