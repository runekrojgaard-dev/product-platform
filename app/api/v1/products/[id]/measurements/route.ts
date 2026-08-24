import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { createMeasurementSchema } from "@/lib/validation/measurement";
import { computeMeasurementResult } from "@/lib/measurement-tolerance";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission("product.view");

    const productionBatchId = req.nextUrl.searchParams.get("productionBatchId") ?? undefined;
    const masterSampleId = req.nextUrl.searchParams.get("masterSampleId") ?? undefined;
    const productVersionId = req.nextUrl.searchParams.get("productVersionId") ?? undefined;
    const observationId = req.nextUrl.searchParams.get("observationId") ?? undefined;

    // Measurement has no direct productId column — scope through whichever
    // parent it's attached to, all of which belong to this product.
    const measurements = await prisma.measurement.findMany({
      where: {
        OR: [
          { productVersion: { productId: params.id } },
          { masterSample: { productId: params.id } },
          { productionBatch: { productId: params.id } },
          { observation: { productId: params.id } },
        ],
        productionBatchId,
        masterSampleId,
        productVersionId,
        observationId,
      },
      select: {
        id: true,
        name: true,
        unit: true,
        referenceValue: true,
        toleranceLower: true,
        toleranceUpper: true,
        measuredValue: true,
        result: true,
        notes: true,
        createdAt: true,
        createdBy: { select: { name: true } },
        productVersion: { select: { versionNumber: true } },
        masterSample: { select: { masterVersionNumber: true } },
        productionBatch: { select: { batchCode: true } },
        observation: { select: { observationCode: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ measurements });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await requirePermission("measurement.record");

    const body = await req.json();
    const parsed = createMeasurementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;

    // Every link, if provided, must actually belong to this product.
    if (d.productVersionId) {
      const v = await prisma.productVersion.findFirst({ where: { id: d.productVersionId, productId: params.id } });
      if (!v) return NextResponse.json({ error: "Version not found on this product" }, { status: 400 });
    }
    if (d.masterSampleId) {
      const m = await prisma.masterSample.findFirst({ where: { id: d.masterSampleId, productId: params.id } });
      if (!m) return NextResponse.json({ error: "Master Sample not found on this product" }, { status: 400 });
    }
    if (d.productionBatchId) {
      const b = await prisma.productionBatch.findFirst({ where: { id: d.productionBatchId, productId: params.id } });
      if (!b) return NextResponse.json({ error: "Production batch not found on this product" }, { status: 400 });
    }
    if (d.observationId) {
      const o = await prisma.observation.findFirst({ where: { id: d.observationId, productId: params.id } });
      if (!o) return NextResponse.json({ error: "Observation not found on this product" }, { status: 400 });
    }
    if (d.photoMediaId) {
      const media = await prisma.media.findFirst({ where: { id: d.photoMediaId, productId: params.id } });
      if (!media) return NextResponse.json({ error: "Photo not found on this product" }, { status: 400 });
    }

    // Rule 7: result is ALWAYS computed here, never accepted from the client.
    const result = computeMeasurementResult(d.referenceValue, d.toleranceLower, d.toleranceUpper, d.measuredValue);

    const created = await prisma.$transaction(async (tx) => {
      const measurement = await tx.measurement.create({
        data: {
          name: d.name,
          unit: d.unit,
          referenceValue: d.referenceValue,
          toleranceLower: d.toleranceLower,
          toleranceUpper: d.toleranceUpper,
          measuredValue: d.measuredValue,
          result,
          notes: d.notes,
          productVersionId: d.productVersionId,
          masterSampleId: d.masterSampleId,
          productionBatchId: d.productionBatchId,
          observationId: d.observationId,
          photoMediaId: d.photoMediaId,
          createdById: userId,
        },
      });

      await writeAuditLog(tx, {
        userId,
        action: "RECORD_MEASUREMENT",
        objectType: "Measurement",
        objectId: measurement.id,
        newValue: { name: d.name, measuredValue: d.measuredValue, result },
      });

      return measurement;
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
