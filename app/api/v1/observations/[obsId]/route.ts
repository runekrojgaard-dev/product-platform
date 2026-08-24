import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { updateObservationSchema } from "@/lib/validation/observation";

export async function GET(_req: NextRequest, { params }: { params: { obsId: string } }) {
  try {
    await requirePermission("observation.view");

    const observation = await prisma.observation.findUnique({
      where: { id: params.obsId },
      include: {
        product: { select: { id: true, name: true, productId: true } },
        productVersion: { select: { versionNumber: true, versionType: true } },
        productionBatch: { select: { batchCode: true } },
        createdBy: { select: { name: true } },
        assignedTo: { select: { id: true, name: true } },
        resolvedBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        media: {
          select: { id: true, description: true, locationArea: true, uploadedAt: true },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          select: { id: true, body: true, createdAt: true, createdBy: { select: { name: true } } },
        },
        correctiveActions: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            description: true,
            status: true,
            createdAt: true,
            completedAt: true,
            assignedTo: { select: { name: true } },
          },
        },
      },
    });

    if (!observation) return NextResponse.json({ error: "Observation not found" }, { status: 404 });

    return NextResponse.json(observation);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { obsId: string } }) {
  try {
    const { userId } = await requirePermission("observation.assign");

    const body = await req.json();
    const parsed = updateObservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.observation.findUnique({ where: { id: params.obsId } });
    if (!existing) return NextResponse.json({ error: "Observation not found" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.observation.update({
        where: { id: params.obsId },
        data: parsed.data,
      });

      await writeAuditLog(tx, {
        userId,
        action: "UPDATE_OBSERVATION_ASSIGNMENT",
        objectType: "Observation",
        objectId: result.id,
        previousValue: { assignedToId: existing.assignedToId, dueDate: existing.dueDate },
        newValue: parsed.data,
      });

      return result;
    });

    return NextResponse.json(updated);
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
