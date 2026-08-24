import { prisma } from "@/lib/db";

/**
 * Aggregates in JS after a single bounded fetch rather than several
 * Prisma `groupBy` calls, because the cross-model joins needed here
 * (issues by project, by supplier) aren't expressible in one groupBy.
 * Fine at MVP data volumes; if this becomes slow as observation counts
 * grow, move it to a raw SQL aggregate query instead of restructuring
 * the whole function.
 */
export async function getDashboardMetrics() {
  const [
    totalProducts,
    activeProjects,
    openObservations,
    criticalIssues,
    pendingApprovals,
    currentMasterSamples,
    productionBatches,
    recentActivity,
    observationsForCharts,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.observation.count({ where: { status: { not: "CLOSED" } } }),
    prisma.observation.count({ where: { severity: "CRITICAL", status: { not: "CLOSED" } } }),
    prisma.masterSample.count({ where: { approvalStatus: "PENDING" } }),
    prisma.masterSample.count({ where: { isCurrent: true } }),
    prisma.productionBatch.count(),
    prisma.auditLog.findMany({
      select: { id: true, action: true, objectType: true, createdAt: true, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.observation.findMany({
      select: {
        category: true,
        createdAt: true,
        product: { select: { name: true, productId: true } },
        productionBatch: { select: { batchCode: true, supplier: true } },
      },
    }),
  ]);

  // Products need their project's name for "issues by project" — fetched
  // separately to avoid an N+1 (one query, then a lookup map).
  const productProjectMap = new Map(
    (
      await prisma.product.findMany({
        select: { id: true, productId: true, project: { select: { name: true } } },
      })
    ).map((p) => [p.productId, p.project.name])
  );

  const byCategory = countBy(observationsForCharts, (o) => o.category);
  const byProduct = countBy(observationsForCharts, (o) => `${o.product.productId} — ${o.product.name}`);
  const byProject = countBy(observationsForCharts, (o) => productProjectMap.get(o.product.productId) ?? "Unknown");
  const bySupplier = countBy(
    observationsForCharts.filter((o) => o.productionBatch?.supplier),
    (o) => o.productionBatch!.supplier!
  );
  const byBatch = countBy(
    observationsForCharts.filter((o) => o.productionBatch?.batchCode),
    (o) => o.productionBatch!.batchCode!
  );
  const overTime = countBy(observationsForCharts, (o) => o.createdAt.toISOString().slice(0, 10));

  return {
    totals: {
      totalProducts,
      activeProjects,
      openObservations,
      criticalIssues,
      pendingApprovals,
      currentMasterSamples,
      productionBatches,
    },
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      action: a.action,
      objectType: a.objectType,
      userName: a.user.name,
      createdAt: a.createdAt.toISOString(),
    })),
    charts: {
      byCategory: toChartData(byCategory).slice(0, 10),
      byProduct: toChartData(byProduct).slice(0, 10),
      byProject: toChartData(byProject).slice(0, 10),
      bySupplier: toChartData(bySupplier).slice(0, 10),
      byBatch: toChartData(byBatch).slice(0, 10),
      overTime: toChartData(overTime).sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function toChartData(map: Map<string, number>): { name: string; count: number }[] {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
