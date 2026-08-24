import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { updateProjectSchema } from "@/lib/validation/project";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await requirePermission("project.manage");

    const body = await req.json();
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.project.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.project.update({
        where: { id: params.id },
        data: parsed.data,
      });
      await writeAuditLog(tx, {
        userId,
        action: "UPDATE_PROJECT",
        objectType: "Project",
        objectId: result.id,
        previousValue: { name: existing.name, status: existing.status },
        newValue: parsed.data,
      });
      return result;
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
