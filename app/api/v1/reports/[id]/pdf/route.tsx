import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { requirePermission, requireSession, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { ProductQualityReport, type ReportData } from "@/lib/reports/product-quality-report";

// GET /api/v1/reports/:id/pdf?productionBatchId=<optional>
// :id is the Product's database id. If a batch is specified, the report is
// scoped to that batch's measurements/observations; otherwise it covers the
// whole product to date.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission("report.view");
    const session = await requireSession();

    const productionBatchId = req.nextUrl.searchParams.get("productionBatchId") ?? undefined;

    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { name: true, customer: { select: { name: true } } } },
        currentMasterSample: {
          select: { masterVersionNumber: true, productVersion: { select: { versionNumber: true } } },
        },
      },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const batch = productionBatchId
      ? await prisma.productionBatch.findFirst({
          where: { id: productionBatchId, productId: params.id },
          select: { batchCode: true, productionDate: true, supplier: true },
        })
      : null;

    const [measurements, observations, correctiveActions, approvals, relatedIds] = await Promise.all([
      prisma.measurement.findMany({
        where: {
          OR: [
            { productVersion: { productId: params.id } },
            { masterSample: { productId: params.id } },
            { productionBatch: { productId: params.id, id: productionBatchId } },
          ],
        },
        select: { name: true, referenceValue: true, unit: true, measuredValue: true, result: true },
      }),
      prisma.observation.findMany({
        where: { productId: params.id, productionBatchId: productionBatchId || undefined },
        select: { observationCode: true, category: true, severity: true, status: true, description: true },
      }),
      prisma.correctiveAction.findMany({
        where: { observation: { productId: params.id } },
        select: { description: true, status: true, observation: { select: { observationCode: true } } },
      }),
      prisma.masterSample.findMany({
        where: { productId: params.id, approvalStatus: { not: "PENDING" } },
        select: {
          masterVersionNumber: true,
          approvalStatus: true,
          approvedDate: true,
          approvedBy: { select: { name: true } },
        },
      }),
      // The timeline must cover everything that happened to this product,
      // not just events logged against the product's own row — versions,
      // Master Samples, batches, and observations each write audit entries
      // under their own id (Section 20: "every event" in the history).
      Promise.all([
        prisma.productVersion.findMany({ where: { productId: params.id }, select: { id: true } }),
        prisma.masterSample.findMany({ where: { productId: params.id }, select: { id: true } }),
        prisma.productionBatch.findMany({ where: { productId: params.id }, select: { id: true } }),
        prisma.observation.findMany({ where: { productId: params.id }, select: { id: true } }),
      ]),
    ]);

    const [versionIds, masterSampleIds, batchIds, observationIds] = relatedIds;
    const allObjectIds = [
      params.id,
      ...versionIds.map((v) => v.id),
      ...masterSampleIds.map((m) => m.id),
      ...batchIds.map((b) => b.id),
      ...observationIds.map((o) => o.id),
    ];

    const auditLog = await prisma.auditLog.findMany({
      where: { objectId: { in: allObjectIds } },
      select: { action: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    const reportData: ReportData = {
      product: {
        productId: product.productId,
        name: product.name,
        category: product.category,
        status: product.status,
      },
      project: { name: product.project.name, customerName: product.project.customer.name },
      masterSample: product.currentMasterSample
        ? {
            masterVersionNumber: product.currentMasterSample.masterVersionNumber,
            versionNumber: product.currentMasterSample.productVersion.versionNumber,
          }
        : null,
      batch: batch
        ? {
            batchCode: batch.batchCode,
            productionDate: batch.productionDate.toISOString(),
            supplier: batch.supplier,
          }
        : null,
      inspector: session.user.name,
      generatedAt: new Date().toISOString(),
      measurements,
      observations,
      correctiveActions: correctiveActions.map((ca) => ({
        description: ca.description,
        status: ca.status,
        observationCode: ca.observation.observationCode,
      })),
      approvals: approvals.map((a) => ({
        label: a.masterVersionNumber,
        approvedBy: a.approvedBy?.name ?? "—",
        approvedDate: a.approvedDate?.toISOString() ?? new Date().toISOString(),
        status: a.approvalStatus,
      })),
      timeline: auditLog.map((a) => ({
        date: a.createdAt.toISOString(),
        description: a.action.replace(/_/g, " "),
      })),
    };

    const pdfBuffer = await renderToBuffer(<ProductQualityReport data={reportData} />);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${product.productId}-quality-report.pdf"`,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
