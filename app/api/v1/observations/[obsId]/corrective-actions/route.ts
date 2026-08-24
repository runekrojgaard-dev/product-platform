import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { createCorrectiveActionSchema } from "@/lib/validation/observation";

export async function POST(req: NextRequest, { params }: { params: { obsId: string } }) {
  try {
    const { userId } = await requirePermission("observation.assign");

    const observation = await prisma.observation.findUnique({ where: { id: params.obsId } });
    if (!observation) return NextResponse.json({ error: "Observation not found" }, { status: 404 });

    const body = await req.json();
    const parsed = createCorrectiveActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const action = await tx.correctiveAction.create({
        data: {
          observationId: observation.id,
          description: parsed.data.description,
          assignedToId: parsed.data.assignedToId,
          status: "NEW",
        },
      });

      await writeAuditLog(tx, {
        userId,
        action: "CREATE_CORRECTIVE_ACTION",
        objectType: "CorrectiveAction",
        objectId: action.id,
        newValue: { observationId: observation.id, description: parsed.data.description },
      });

      return action;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
