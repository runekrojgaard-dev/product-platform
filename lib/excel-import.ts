import * as XLSX from "xlsx";

export type ParsedProjectRow = {
  rowNumber: number;
  projectName: string;
  customerName: string;
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
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

    if (!projectName || !customerName) {
      errors.push({
        rowNumber,
        message: "Missing required 'Project Name' or 'Customer' value",
      });
      return;
    }

    rows.push({
      rowNumber,
      projectName,
      customerName,
      status: STATUS_MAP[statusRaw] ?? "ACTIVE",
    });
  });

  return { rows, errors };
}
