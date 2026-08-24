import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { updateProductionBatchSchema } from "@/lib/validation/production-batch";

export async function PATCH(req: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    const { userId } = await requirePermission("production.batch.manage");

    const body = await req.json();
    const parsed = updateProductionBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.productionBatch.findUnique({ where: { id: params.batchId } });
    if (!existing) return NextResponse.json({ error: "Production batch not found" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.productionBatch.update({
        where: { id: params.batchId },
        data: parsed.data,
      });

      await writeAuditLog(tx, {
        userId,
        action: "UPDATE_PRODUCTION_BATCH",
        objectType: "ProductionBatch",
        objectId: result.id,
        previousValue: { status: existing.status, quantity: existing.quantity, notes: existing.notes },
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
