import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { createProjectSchema } from "@/lib/validation/project";

export async function GET() {
  try {
    await requirePermission("project.view");

    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        customer: { select: { id: true, name: true } },
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ projects });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requirePermission("project.manage");

    const body = await req.json();
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({ where: { id: parsed.data.customerId } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: parsed.data.name,
          customerId: parsed.data.customerId,
          status: parsed.data.status ?? "ACTIVE",
        },
      });
      await writeAuditLog(tx, {
        userId,
        action: "CREATE_PROJECT",
        objectType: "Project",
        objectId: project.id,
        newValue: parsed.data,
      });
      return project;
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
