"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const UNITS = ["mm", "cm", "m", "kg", "degrees"] as const;

type Result = "PASS" | "WARNING" | "FAIL";

const RESULT_STYLES: Record<Result, string> = {
  PASS: "bg-green-50 text-green-700 border-green-200",
  WARNING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  FAIL: "bg-red-50 text-red-700 border-red-200",
};

type MeasurementRow = {
  id: string;
  name: string;
  unit: string;
  referenceValue: number;
  toleranceLower: number;
  toleranceUpper: number;
  measuredValue: number;
  result: Result;
  notes: string | null;
  createdAt: string;
  context: string;
};


export function MeasurementsSection({
  productId,
  canRecord,
  versions,
  masterSamples,
  productionBatches,
  observations,
  initialMeasurements,
}: {
  productId: string;
  canRecord: boolean;
  versions: { id: string; versionNumber: string }[];
  masterSamples: { id: string; label: string }[];
  productionBatches: { id: string; label: string }[];
  observations: { id: string; label: string }[];
  initialMeasurements: MeasurementRow[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [linkType, setLinkType] = useState<"version" | "masterSample" | "productionBatch" | "observation">(
    "version"
  );
  const [linkId, setLinkId] = useState("");
  const [form, setForm] = useState({
    name: "",
    unit: "mm" as (typeof UNITS)[number],
    referenceValue: "",
    toleranceLower: "",
    toleranceUpper: "",
    measuredValue: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const linkOptions: { value: string; label: string }[] =
    linkType === "version"
      ? versions.map((v) => ({ value: v.id, label: v.versionNumber }))
      : linkType === "masterSample"
        ? masterSamples.map((m) => ({ value: m.id, label: m.label }))
        : linkType === "productionBatch"
          ? productionBatches.map((b) => ({ value: b.id, label: b.label }))
          : observations.map((o) => ({ value: o.id, label: o.label }));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!linkId) {
      setError("Select what this measurement is linked to.");
      return;
    }
    setSubmitting(true);
    try {
      const linkField =
        linkType === "version"
          ? "productVersionId"
          : linkType === "masterSample"
            ? "masterSampleId"
            : linkType === "productionBatch"
              ? "productionBatchId"
              : "observationId";

      const res = await fetch(`/api/v1/products/${productId}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          unit: form.unit,
          referenceValue: Number(form.referenceValue),
          toleranceLower: Number(form.toleranceLower),
          toleranceUpper: Number(form.toleranceUpper),
          measuredValue: Number(form.measuredValue),
          notes: form.notes || undefined,
          [linkField]: linkId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to record measurement");
        return;
      }
      setShowForm(false);
      setForm({ name: "", unit: "mm", referenceValue: "", toleranceLower: "", toleranceUpper: "", measuredValue: "", notes: "" });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {canRecord &&
        (showForm ? (
          <form onSubmit={handleCreate} className="bg-white border border-neutral-200 rounded-lg p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Linked to</label>
                <div className="flex gap-2">
                  <select
                    value={linkType}
                    onChange={(e) => {
                      setLinkType(e.target.value as typeof linkType);
                      setLinkId("");
                    }}
                    className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                  >
                    <option value="version">Version</option>
                    <option value="masterSample">Master Sample</option>
                    <option value="productionBatch">Production Batch</option>
                    <option value="observation">Observation</option>
                  </select>
                  <select
                    value={linkId}
                    onChange={(e) => setLinkId(e.target.value)}
                    className="flex-1 rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                  >
                    <option value="">Select…</option>
                    {linkOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Measurement name</label>
                <input
                  required
                  placeholder="e.g. Seat Height"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Reference</label>
                <input
                  required
                  type="number"
                  step="any"
                  value={form.referenceValue}
                  onChange={(e) => setForm({ ...form, referenceValue: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Tolerance −</label>
                <input
                  required
                  type="number"
                  step="any"
                  min={0}
                  value={form.toleranceLower}
                  onChange={(e) => setForm({ ...form, toleranceLower: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Tolerance +</label>
                <input
                  required
                  type="number"
                  step="any"
                  min={0}
                  value={form.toleranceUpper}
                  onChange={(e) => setForm({ ...form, toleranceUpper: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Measured</label>
                <input
                  required
                  type="number"
                  step="any"
                  value={form.measuredValue}
                  onChange={(e) => setForm({ ...form, measuredValue: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Unit</label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value as (typeof UNITS)[number] })}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
              />
            </div>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <div className="flex gap-2">
              <button
                disabled={submitting}
                className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
              >
                {submitting ? "Recording…" : "Record measurement"}
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
            + Record Measurement
          </button>
        ))}

      {initialMeasurements.length === 0 ? (
        <p className="text-sm text-neutral-400 bg-white border border-dashed border-neutral-300 rounded-lg px-4 py-6 text-center">
          No measurements recorded.
        </p>
      ) : (
        <table className="w-full text-sm bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Measurement</th>
              <th className="text-left px-4 py-2 font-medium">Reference</th>
              <th className="text-left px-4 py-2 font-medium">Measured</th>
              <th className="text-left px-4 py-2 font-medium">Result</th>
              <th className="text-left px-4 py-2 font-medium">Context</th>
            </tr>
          </thead>
          <tbody>
            {initialMeasurements.map((m) => (
              <tr key={m.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 text-neutral-900">{m.name}</td>
                <td className="px-4 py-2 text-neutral-600">
                  {m.referenceValue} {m.unit} (±{m.toleranceLower}/{m.toleranceUpper})
                </td>
                <td className="px-4 py-2 text-neutral-800 font-medium">
                  {m.measuredValue} {m.unit}
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${RESULT_STYLES[m.result]}`}>
                    {m.result}
                  </span>
                </td>
                <td className="px-4 py-2 text-neutral-500">{m.context}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
