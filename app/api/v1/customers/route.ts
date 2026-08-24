import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { createCustomerSchema } from "@/lib/validation/customer";

export async function GET() {
  try {
    // Anyone who can view projects needs to see the customer list for context/filtering.
    await requirePermission("project.view");

    const customers = await prisma.customer.findMany({
      select: { id: true, name: true, contactInfo: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ customers });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requirePermission("customer.manage");

    const body = await req.json();
    const parsed = createCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({ data: parsed.data });
      await writeAuditLog(tx, {
        userId,
        action: "CREATE_CUSTOMER",
        objectType: "Customer",
        objectId: customer.id,
        newValue: parsed.data,
      });
      return customer;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
