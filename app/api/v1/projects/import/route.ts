import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { parseProjectsWorkbook } from "@/lib/excel-import";

const ACCEPTED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
];

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requirePermission("project.manage");

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A 'file' field with the spreadsheet is required" }, { status: 400 });
    }
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.xlsx?$/i)) {
      return NextResponse.json({ error: "File must be an .xlsx or .xls spreadsheet" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, errors: parseErrors } = parseProjectsWorkbook(buffer);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "No valid project rows found. Expected columns: 'Project Name', 'Customer', 'Status' (optional).",
          details: parseErrors,
        },
        { status: 400 }
      );
    }

    const created: string[] = [];
    const skipped: { rowNumber: number; reason: string }[] = [];

    await prisma.$transaction(async (tx) => {
      // Cache customer lookups within this import so the same customer
      // name appearing on multiple rows only hits the DB once.
      const customerCache = new Map<string, string>();

      for (const row of rows) {
        const customerKey = row.customerName.toLowerCase();
        let customerId = customerCache.get(customerKey);

        if (!customerId) {
          const existing = await tx.customer.findFirst({
            where: { name: { equals: row.customerName, mode: "insensitive" } },
          });
          if (existing) {
            customerId = existing.id;
          } else {
            const newCustomer = await tx.customer.create({ data: { name: row.customerName } });
            customerId = newCustomer.id;
          }
          customerCache.set(customerKey, customerId);
        }

        // Skip rows that would duplicate an existing project for the same
        // customer, so re-uploading the same sheet (e.g. with a few new
        // rows added) doesn't create duplicates of what's already there.
        const existingProject = await tx.project.findFirst({
          where: { name: { equals: row.projectName, mode: "insensitive" }, customerId },
        });
        if (existingProject) {
          skipped.push({ rowNumber: row.rowNumber, reason: `"${row.projectName}" already exists for this customer` });
          continue;
        }

        const project = await tx.project.create({
          data: { name: row.projectName, customerId, status: row.status },
        });
        created.push(project.name);
      }

      await writeAuditLog(tx, {
        userId,
        action: "BULK_IMPORT_PROJECTS",
        objectType: "Project",
        objectId: "bulk-import",
        newValue: { createdCount: created.length, skippedCount: skipped.length, fileName: file.name },
      });
    });

    return NextResponse.json({
      createdCount: created.length,
      createdNames: created,
      skipped,
      parseErrors,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
