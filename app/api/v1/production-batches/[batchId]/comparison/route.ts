import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";

// GET /api/v1/production-batches/:batchId/comparison
// Matches Master Sample measurements to the batch's own measurements by
// name, so a desktop user can see Master vs. Production side by side
// (Section 18). Each row already carries its own computed PASS/WARNING/FAIL
// from when it was recorded — this endpoint only joins them for display.
export async function GET(_req: NextRequest, { params: paramsPromise }: { params: Promise<{ batchId: string }> }) {
  const params = await paramsPromise;
  try {
    await requirePermission("product.view");

    const batch = await prisma.productionBatch.findUnique({
      where: { id: params.batchId },
      include: {
        product: { select: { id: true, name: true, productId: true } },
        masterSample: { select: { id: true, masterVersionNumber: true } },
      },
    });
    if (!batch) return NextResponse.json({ error: "Production batch not found" }, { status: 404 });

    const [masterMeasurements, batchMeasurements] = await Promise.all([
      prisma.measurement.findMany({
        where: { masterSampleId: batch.masterSampleId },
        select: { name: true, unit: true, referenceValue: true, toleranceLower: true, toleranceUpper: true, measuredValue: true, result: true },
      }),
      prisma.measurement.findMany({
        where: { productionBatchId: batch.id },
        select: { name: true, unit: true, measuredValue: true, result: true },
      }),
    ]);

    const masterByName = new Map(masterMeasurements.map((m) => [m.name, m]));
    const batchByName = new Map(batchMeasurements.map((m) => [m.name, m]));
    const allNames = new Set([...masterByName.keys(), ...batchByName.keys()]);

    const rows = [...allNames].map((name) => ({
      name,
      master: masterByName.get(name) ?? null,
      production: batchByName.get(name) ?? null,
    }));

    return NextResponse.json({
      product: batch.product,
      batch: { id: batch.id, batchCode: batch.batchCode },
      masterSample: batch.masterSample,
      rows,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
