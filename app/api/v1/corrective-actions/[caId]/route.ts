import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { updateCorrectiveActionSchema } from "@/lib/validation/observation";

export async function PATCH(req: NextRequest, { params: paramsPromise }: { params: Promise<{ caId: string }> }) {
  const params = await paramsPromise;
  try {
    const { userId } = await requirePermission("observation.assign");

    const existing = await prisma.correctiveAction.findUnique({ where: { id: params.caId } });
    if (!existing) return NextResponse.json({ error: "Corrective action not found" }, { status: 404 });

    const body = await req.json();
    const parsed = updateCorrectiveActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.correctiveAction.update({
        where: { id: params.caId },
        data: {
          status: parsed.data.status,
          completedAt: parsed.data.status === "FIXED" ? new Date() : parsed.data.completedAt,
        },
      });

      await writeAuditLog(tx, {
        userId,
        action: "UPDATE_CORRECTIVE_ACTION",
        objectType: "CorrectiveAction",
        objectId: result.id,
        previousValue: { status: existing.status },
        newValue: { status: parsed.data.status },
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
