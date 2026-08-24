"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

type ChartRow = { name: string; count: number };

export function DashboardCharts({
  charts,
}: {
  charts: {
    byCategory: ChartRow[];
    byProduct: ChartRow[];
    byProject: ChartRow[];
    bySupplier: ChartRow[];
    byBatch: ChartRow[];
    overTime: ChartRow[];
  };
}) {
  const hasAnyData = Object.values(charts).some((c) => c.length > 0);

  if (!hasAnyData) {
    return (
      <p className="text-sm text-neutral-400 bg-white border border-dashed border-neutral-300 rounded-lg px-4 py-6 text-center">
        Charts will populate once observations are recorded.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ChartCard title="Issues by Category" data={charts.byCategory} />
      <ChartCard title="Issues by Product" data={charts.byProduct} />
      <ChartCard title="Issues by Project" data={charts.byProject} />
      <ChartCard title="Issues by Supplier" data={charts.bySupplier} />
      <ChartCard title="Issues by Production Batch" data={charts.byBatch} />
      <TimeSeriesCard title="Issues Over Time" data={charts.overTime} />
    </div>
  );
}

function ChartCard({ title, data }: { title: string; data: ChartRow[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-neutral-900 mb-2">{title}</h3>
        <p className="text-sm text-neutral-400">No data yet.</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-neutral-900 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#171717" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TimeSeriesCard({ title, data }: { title: string; data: ChartRow[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-neutral-900 mb-2">{title}</h3>
        <p className="text-sm text-neutral-400">No data yet.</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-neutral-900 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#171717" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
