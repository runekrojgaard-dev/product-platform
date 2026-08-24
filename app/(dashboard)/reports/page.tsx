import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!roleHasPermission(session.user.role, "report.view")) redirect("/dashboard");

  const products = await prisma.product.findMany({
    select: {
      id: true,
      productId: true,
      name: true,
      status: true,
      productionBatches: { select: { id: true, batchCode: true }, orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-lg font-semibold text-neutral-900 mb-1">Reports</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Generate a Product Quality Report — measurements, observations, corrective actions,
        approvals, and timeline in one PDF suitable for customers or suppliers.
      </p>

      <div className="bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100">
        {products.map((p) => (
          <div key={p.id} className="px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="font-mono text-xs text-neutral-500 mr-2">{p.productId}</span>
              <span className="text-sm text-neutral-900">{p.name}</span>
              <span className="text-xs text-neutral-400 ml-2">{p.status.replace(/_/g, " ")}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <a
                href={`/api/v1/reports/${p.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-neutral-700 border border-neutral-300 rounded px-2.5 py-1 hover:bg-neutral-100"
              >
                Full Report (PDF)
              </a>
              {p.productionBatches.map((b) => (
                <a
                  key={b.id}
                  href={`/api/v1/reports/${p.id}/pdf?productionBatchId=${b.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-neutral-500 border border-neutral-200 rounded px-2.5 py-1 hover:bg-neutral-100"
                >
                  {b.batchCode} (PDF)
                </a>
              ))}
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">No products yet.</p>
        )}
      </div>
    </div>
  );
}
