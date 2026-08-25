import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { createObservationSchema } from "@/lib/validation/observation";
import { generateObservationCode } from "@/lib/observation-code";

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    await requirePermission("observation.view");

    const status = req.nextUrl.searchParams.get("status") ?? undefined;

    const observations = await prisma.observation.findMany({
      where: { productId: params.id, status: status as never },
      select: {
        id: true,
        observationCode: true,
        category: true,
        subcategory: true,
        description: true,
        severity: true,
        status: true,
        location: true,
        createdAt: true,
        dueDate: true,
        createdBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
        productVersion: { select: { versionNumber: true } },
        _count: { select: { media: true, comments: true, correctiveActions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ observations });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const { userId } = await requirePermission("observation.create");

    const body = await req.json();
    const parsed = createObservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const version = await prisma.productVersion.findFirst({
      where: { id: parsed.data.productVersionId, productId: params.id },
    });
    if (!version) return NextResponse.json({ error: "Version not found on this product" }, { status: 400 });

    if (parsed.data.productionBatchId) {
      const batch = await prisma.productionBatch.findFirst({
        where: { id: parsed.data.productionBatchId, productId: params.id },
      });
      if (!batch) return NextResponse.json({ error: "Batch not found on this product" }, { status: 400 });
    }

    const category = await prisma.defectCategory.findFirst({
      where: { name: parsed.data.category, active: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Unknown or inactive defect category" }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const observationCode = await generateObservationCode(tx);

      const observation = await tx.observation.create({
        data: {
          observationCode,
          productId: params.id,
          productVersionId: parsed.data.productVersionId,
          productionBatchId: parsed.data.productionBatchId,
          category: parsed.data.category,
          subcategory: parsed.data.subcategory,
          description: parsed.data.description,
          severity: parsed.data.severity,
          location: parsed.data.location,
          locationDetail: parsed.data.locationDetail,
          assignedToId: parsed.data.assignedToId,
          dueDate: parsed.data.dueDate,
          status: "NEW",
          createdById: userId,
        },
      });

      await writeAuditLog(tx, {
        userId,
        action: "CREATE_OBSERVATION",
        objectType: "Observation",
        objectId: observation.id,
        newValue: {
          observationCode,
          category: parsed.data.category,
          severity: parsed.data.severity,
          productId: params.id,
        },
      });

      return observation;
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
