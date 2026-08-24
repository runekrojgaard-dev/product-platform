"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const LOCATIONS = [
  "BACK",
  "SEAT",
  "ARMREST",
  "LEG",
  "FRAME",
  "TABLETOP",
  "EDGE",
  "JOINT",
  "SURFACE",
  "UNDERSIDE",
  "INTERIOR",
  "OTHER",
] as const;

const SEVERITY_STYLES: Record<(typeof SEVERITIES)[number], string> = {
  LOW: "bg-green-50 text-green-700 border-green-200",
  MEDIUM: "bg-yellow-50 text-yellow-700 border-yellow-200",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200",
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
};

type ObservationRow = {
  id: string;
  observationCode: string;
  category: string;
  description: string;
  severity: (typeof SEVERITIES)[number];
  status: string;
  location: string;
  createdAt: string;
  dueDate: string | null;
  createdByName: string;
  assignedToName: string | null;
  versionNumber: string;
};

export function ObservationsSection({
  productId,
  canCreate,
  categories,
  versions,
  assignableUsers,
  initialObservations,
}: {
  productId: string;
  canCreate: boolean;
  categories: string[];
  versions: { id: string; versionNumber: string }[];
  assignableUsers: { id: string; name: string }[];
  initialObservations: ObservationRow[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    productVersionId: versions[versions.length - 1]?.id ?? "",
    category: categories[0] ?? "",
    description: "",
    severity: "MEDIUM" as (typeof SEVERITIES)[number],
    location: "OTHER" as (typeof LOCATIONS)[number],
    assignedToId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/products/${productId}/observations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          assignedToId: form.assignedToId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create observation");
        return;
      }
      setShowForm(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (versions.length === 0) {
    return (
      <p className="text-sm text-neutral-400 bg-white border border-dashed border-neutral-300 rounded-lg px-4 py-6 text-center">
        At least one version must exist before observations can be recorded.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {canCreate &&
        (showForm ? (
          <form onSubmit={handleCreate} className="bg-white border border-neutral-200 rounded-lg p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Version</label>
                <select
                  value={form.productVersionId}
                  onChange={(e) => setForm({ ...form, productVersionId: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.versionNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Severity</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value as typeof form.severity })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Location</label>
                <select
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value as typeof form.location })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                >
                  {LOCATIONS.map((l) => (
                    <option key={l} value={l}>
                      {l.charAt(0) + l.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Assign to</label>
                <select
                  value={form.assignedToId}
                  onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                >
                  <option value="">Unassigned</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
              <textarea
                required
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
              />
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              <button
                disabled={submitting}
                className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create observation"}
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
            + New Observation
          </button>
        ))}

      {initialObservations.length === 0 ? (
        <p className="text-sm text-neutral-400 bg-white border border-dashed border-neutral-300 rounded-lg px-4 py-6 text-center">
          No observations recorded.
        </p>
      ) : (
        <div className="space-y-2">
          {initialObservations.map((o) => (
            <Link
              key={o.id}
              href={`/products/${productId}/observations/${o.id}`}
              className="block bg-white border border-neutral-200 rounded-lg px-4 py-3 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-900">
                  {o.observationCode} — {o.category}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded border ${SEVERITY_STYLES[o.severity]}`}>
                  {o.severity}
                </span>
              </div>
              <p className="text-sm text-neutral-600 truncate mt-0.5">{o.description}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                  {o.status.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-neutral-400">
                  {o.versionNumber} · {o.assignedToName ? `Assigned to ${o.assignedToName}` : "Unassigned"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
