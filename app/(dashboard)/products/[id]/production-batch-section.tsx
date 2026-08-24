"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type BatchStatus = "PLANNED" | "IN_PRODUCTION" | "COMPLETED" | "ON_HOLD";

type BatchRow = {
  id: string;
  batchCode: string;
  productionDate: string;
  productionLocation: string | null;
  supplier: string | null;
  quantity: number;
  status: BatchStatus;
  notes: string | null;
  productionManagerName: string | null;
  masterVersionNumber: string;
};

type MasterSampleOption = { id: string; masterVersionNumber: string; isCurrent: boolean };

const STATUS_STYLES: Record<BatchStatus, string> = {
  PLANNED: "bg-neutral-100 text-neutral-600 border-neutral-200",
  IN_PRODUCTION: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-green-50 text-green-700 border-green-200",
  ON_HOLD: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

export function ProductionBatchSection({
  productId,
  canManage,
  approvedMasterSamples,
  initialBatches,
}: {
  productId: string;
  canManage: boolean;
  approvedMasterSamples: MasterSampleOption[];
  initialBatches: BatchRow[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    masterSampleId: approvedMasterSamples.find((m) => m.isCurrent)?.id ?? approvedMasterSamples[0]?.id ?? "",
    productionDate: new Date().toISOString().slice(0, 10),
    productionLocation: "",
    supplier: "",
    quantity: "1",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/products/${productId}/production-batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          productionLocation: form.productionLocation || undefined,
          supplier: form.supplier || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create production batch");
        return;
      }
      setShowForm(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, status: BatchStatus) {
    await fetch(`/api/v1/production-batches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  if (approvedMasterSamples.length === 0) {
    return (
      <p className="text-sm text-neutral-400 bg-white border border-dashed border-neutral-300 rounded-lg px-4 py-6 text-center">
        A Master Sample must be approved before production batches can be created.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {canManage &&
        (showForm ? (
          <form onSubmit={handleCreate} className="bg-white border border-neutral-200 rounded-lg p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Master Sample</label>
                <select
                  value={form.masterSampleId}
                  onChange={(e) => setForm({ ...form, masterSampleId: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                >
                  {approvedMasterSamples.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.masterVersionNumber}
                      {m.isCurrent ? " (current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Production date</label>
                <input
                  type="date"
                  required
                  value={form.productionDate}
                  onChange={(e) => setForm({ ...form, productionDate: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Location</label>
                <input
                  value={form.productionLocation}
                  onChange={(e) => setForm({ ...form, productionLocation: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Supplier</label>
                <input
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              <button
                disabled={submitting}
                className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create batch"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded border border-neutral-300 text-sm font-medium px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2"
          >
            + New Production Batch
          </button>
        ))}

      {initialBatches.length === 0 ? (
        <p className="text-sm text-neutral-400 bg-white border border-dashed border-neutral-300 rounded-lg px-4 py-6 text-center">
          No production batches yet.
        </p>
      ) : (
        <table className="w-full text-sm bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Batch</th>
              <th className="text-left px-4 py-2 font-medium">Master Sample</th>
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-left px-4 py-2 font-medium">Qty</th>
              <th className="text-left px-4 py-2 font-medium">Supplier</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {initialBatches.map((b) => (
              <tr key={b.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-mono text-xs text-neutral-900">{b.batchCode}</td>
                <td className="px-4 py-2 text-neutral-600">{b.masterVersionNumber}</td>
                <td className="px-4 py-2 text-neutral-600">
                  {new Date(b.productionDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-neutral-600">{b.quantity}</td>
                <td className="px-4 py-2 text-neutral-600">{b.supplier ?? "—"}</td>
                <td className="px-4 py-2">
                  {canManage ? (
                    <select
                      value={b.status}
                      onChange={(e) => handleStatusChange(b.id, e.target.value as BatchStatus)}
                      className={`text-xs font-medium px-2 py-1 rounded border ${STATUS_STYLES[b.status]}`}
                    >
                      {(["PLANNED", "IN_PRODUCTION", "COMPLETED", "ON_HOLD"] as BatchStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`text-xs font-medium px-2 py-1 rounded border ${STATUS_STYLES[b.status]}`}>
                      {b.status.replace(/_/g, " ")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/products/${productId}/production-batches/${b.id}/compare`}
                    className="text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:underline whitespace-nowrap"
                  >
                    Compare to Master
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
