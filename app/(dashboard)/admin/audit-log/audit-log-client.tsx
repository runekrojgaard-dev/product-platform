"use client";

import { useState } from "react";

type AuditEntry = {
  id: string;
  action: string;
  objectType: string;
  objectId: string;
  previousValue: unknown;
  newValue: unknown;
  createdAt: string;
  userName: string;
};

export function AuditLogClient({ initialEntries, total }: { initialEntries: AuditEntry[]; total: number }) {
  const [entries, setEntries] = useState(initialEntries);
  const [objectTypeFilter, setObjectTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  async function applyFilter(nextObjectType: string, nextPage: number) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(nextPage) });
      if (nextObjectType) params.set("objectType", nextObjectType);
      const res = await fetch(`/api/v1/audit?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setEntries(data.entries);
        setPage(nextPage);
      }
    } finally {
      setLoading(false);
    }
  }

  const objectTypes = [
    "Product",
    "ProductVersion",
    "MasterSample",
    "ProductionBatch",
    "Observation",
    "CorrectiveAction",
    "Media",
    "User",
    "Project",
    "Customer",
    "DefectCategory",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select
          value={objectTypeFilter}
          onChange={(e) => {
            setObjectTypeFilter(e.target.value);
            applyFilter(e.target.value, 1);
          }}
          className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
        >
          <option value="">All object types</option>
          {objectTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-400">{total} total entries</span>
      </div>

      <table className="w-full text-sm bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-2 font-medium">When</th>
            <th className="text-left px-4 py-2 font-medium">Who</th>
            <th className="text-left px-4 py-2 font-medium">Action</th>
            <th className="text-left px-4 py-2 font-medium">Object</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-neutral-100 align-top">
              <td className="px-4 py-2 text-neutral-500 whitespace-nowrap">
                {new Date(e.createdAt).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-neutral-900 whitespace-nowrap">{e.userName}</td>
              <td className="px-4 py-2 text-neutral-700">{e.action.replace(/_/g, " ")}</td>
              <td className="px-4 py-2 text-neutral-500">
                <span className="font-mono text-xs">
                  {e.objectType}:{e.objectId.slice(0, 8)}
                </span>
                {(e.previousValue || e.newValue) ? (
                  <details className="mt-1">
                    <summary className="text-xs text-neutral-400 cursor-pointer">details</summary>
                    <pre className="text-[10px] bg-neutral-50 rounded p-2 mt-1 overflow-x-auto max-w-md">
                      {JSON.stringify({ before: e.previousValue, after: e.newValue }, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-neutral-400 text-sm">
                No audit entries match this filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex gap-2">
        <button
          disabled={page <= 1 || loading}
          onClick={() => applyFilter(objectTypeFilter, page - 1)}
          className="text-xs font-medium px-3 py-1.5 rounded border border-neutral-300 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-xs text-neutral-400 self-center">Page {page}</span>
        <button
          disabled={entries.length < 50 || loading}
          onClick={() => applyFilter(objectTypeFilter, page + 1)}
          className="text-xs font-medium px-3 py-1.5 rounded border border-neutral-300 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
