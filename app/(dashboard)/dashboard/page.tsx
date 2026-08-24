import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDashboardMetrics } from "@/lib/dashboard-metrics";
import { DashboardCharts } from "./dashboard-charts";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const metrics = await getDashboardMetrics();

  const cards = [
    { label: "Products", value: metrics.totals.totalProducts },
    { label: "Active Projects", value: metrics.totals.activeProjects },
    { label: "Open Issues", value: metrics.totals.openObservations },
    { label: "Critical", value: metrics.totals.criticalIssues, accent: metrics.totals.criticalIssues > 0 },
    { label: "Pending Approval", value: metrics.totals.pendingApprovals },
    { label: "Master Samples", value: metrics.totals.currentMasterSamples },
    { label: "Production Batches", value: metrics.totals.productionBatches },
  ];

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-lg font-semibold text-neutral-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`bg-white border rounded-lg px-4 py-3 ${c.accent ? "border-red-300" : "border-neutral-200"}`}
          >
            <p className={`text-2xl font-semibold ${c.accent ? "text-red-600" : "text-neutral-900"}`}>{c.value}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <DashboardCharts charts={metrics.charts} />

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Recent Activity</h2>
        <div className="bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100">
          {metrics.recentActivity.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-neutral-400">No activity yet.</p>
          )}
          {metrics.recentActivity.map((a) => (
            <div key={a.id} className="px-4 py-2.5 text-sm flex items-center justify-between">
              <span className="text-neutral-700">
                {a.userName} — {a.action.replace(/_/g, " ").toLowerCase()}
              </span>
              <span className="text-xs text-neutral-400">{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
