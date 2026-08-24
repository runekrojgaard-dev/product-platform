"use client";

import { useEffect, useState } from "react";

type VersionOption = { id: string; versionNumber: string; versionType: string };

type FieldDiff = {
  key: string;
  status: "added" | "removed" | "changed" | "unchanged";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

type ComparisonResult = {
  a: { versionNumber: string; versionType: string };
  b: { versionNumber: string; versionType: string };
  diff: {
    dimensions: FieldDiff[];
    materials: FieldDiff[];
    finishes: FieldDiff[];
    components: FieldDiff[];
    specifications: FieldDiff[];
    descriptionChanged: boolean;
  };
};

const STATUS_STYLES: Record<FieldDiff["status"], string> = {
  added: "bg-green-50 text-green-800",
  removed: "bg-red-50 text-red-800",
  changed: "bg-yellow-50 text-yellow-800",
  unchanged: "text-neutral-500",
};

export function CompareClient({
  productId,
  versions,
}: {
  productId: string;
  versions: VersionOption[];
}) {
  const [aId, setAId] = useState(versions[0]?.id ?? "");
  const [bId, setBId] = useState(versions[versions.length - 1]?.id ?? "");
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!aId || !bId || aId === bId) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetch-on-selection-change pattern
    setLoading(true);
    setError(null);
    fetch(`/api/v1/products/${productId}/versions/compare?a=${aId}&b=${bId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to compare");
        setResult(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [aId, bId, productId]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Version A</label>
          <select
            value={aId}
            onChange={(e) => setAId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.versionNumber} — {v.versionType.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Version B</label>
          <select
            value={bId}
            onChange={(e) => setBId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.versionNumber} — {v.versionType.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {aId === bId && <p className="text-sm text-neutral-400">Select two different versions.</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-neutral-400">Comparing…</p>}

      {result && aId !== bId && !loading && (
        <div className="space-y-6">
          <DiffSection title="Dimensions" entries={result.diff.dimensions} valueField="value" unitField="unit" />
          <DiffSection title="Materials" entries={result.diff.materials} valueField="material" />
          <DiffSection title="Finishes" entries={result.diff.finishes} valueField="finish" />
          <DiffSection title="Components" entries={result.diff.components} valueField="description" />
          <DiffSection title="Other Specifications" entries={result.diff.specifications} valueField="value" />
        </div>
      )}
    </div>
  );
}

function DiffSection({
  title,
  entries,
  valueField,
  unitField,
}: {
  title: string;
  entries: FieldDiff[];
  valueField: string;
  unitField?: string;
}) {
  const changedEntries = entries.filter((e) => e.status !== "unchanged");
  if (entries.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900 mb-2">{title}</h3>
      {changedEntries.length === 0 ? (
        <p className="text-sm text-neutral-400">No changes.</p>
      ) : (
        <table className="w-full text-sm bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Item</th>
              <th className="text-left px-4 py-2 font-medium">Before</th>
              <th className="text-left px-4 py-2 font-medium">After</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {changedEntries.map((e) => (
              <tr key={e.key} className={`border-t border-neutral-100 ${STATUS_STYLES[e.status]}`}>
                <td className="px-4 py-2 font-medium">{e.key}</td>
                <td className="px-4 py-2">{formatEntry(e.before, valueField, unitField)}</td>
                <td className="px-4 py-2">{formatEntry(e.after, valueField, unitField)}</td>
                <td className="px-4 py-2 capitalize">{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function formatEntry(
  entry: Record<string, unknown> | null,
  valueField: string,
  unitField?: string
): string {
  if (!entry) return "—";
  const value = entry[valueField];
  const unit = unitField ? entry[unitField] : undefined;
  if (value === undefined) return "—";
  return unit ? `${value} ${unit}` : String(value);
}
