import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { createProductionBatchSchema } from "@/lib/validation/production-batch";
import { generateBatchCode } from "@/lib/batch-code";

export async function GET(_req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    await requirePermission("product.view");

    const batches = await prisma.productionBatch.findMany({
      where: { productId: params.id },
      select: {
        id: true,
        batchCode: true,
        productionDate: true,
        productionLocation: true,
        supplier: true,
        quantity: true,
        status: true,
        notes: true,
        createdAt: true,
        productionManager: { select: { name: true } },
        masterSample: { select: { masterVersionNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ batches });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const { userId } = await requirePermission("production.batch.manage");

    const body = await req.json();
    const parsed = createProductionBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const masterSample = await prisma.masterSample.findFirst({
      where: { id: parsed.data.masterSampleId, productId: params.id },
    });
    if (!masterSample) {
      return NextResponse.json({ error: "Master Sample not found on this product" }, { status: 404 });
    }
    // Production must always reference an APPROVED reference, per Section 8
    // ("The Master Sample is the approved reference for production").
    if (masterSample.approvalStatus !== "APPROVED") {
      return NextResponse.json(
        { error: "Only an approved Master Sample can be used for production" },
        { status: 409 }
      );
    }

    if (parsed.data.productionManagerId) {
      const manager = await prisma.user.findUnique({ where: { id: parsed.data.productionManagerId } });
      if (!manager) return NextResponse.json({ error: "Production manager not found" }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const batchCode = await generateBatchCode(tx, parsed.data.productionDate);

      const batch = await tx.productionBatch.create({
        data: {
          batchCode,
          productId: params.id,
          masterSampleId: masterSample.id,
          productionDate: parsed.data.productionDate,
          productionLocation: parsed.data.productionLocation,
          supplier: parsed.data.supplier,
          quantity: parsed.data.quantity,
          productionManagerId: parsed.data.productionManagerId,
          notes: parsed.data.notes,
          status: "PLANNED",
        },
      });

      await writeAuditLog(tx, {
        userId,
        action: "CREATE_PRODUCTION_BATCH",
        objectType: "ProductionBatch",
        objectId: batch.id,
        newValue: { batchCode, productId: params.id, masterSampleId: masterSample.id, quantity: parsed.data.quantity },
      });

      return batch;
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
