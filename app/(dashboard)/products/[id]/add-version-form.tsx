"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const VERSION_TYPES = [
  "FIRST_PROTOTYPE",
  "PROTOTYPE",
  "DEVELOPMENT",
  "PRE_PRODUCTION",
  "MASTER_SAMPLE",
  "PRODUCTION",
  "QUALITY_CONTROL",
  "DELIVERY",
  "ASSEMBLY_INSTALLATION",
  "COMPLETED",
  "SERVICE_CLAIM",
] as const;

const UNITS = ["mm", "cm", "m", "kg", "degrees"] as const;

type Dimension = { name: string; value: string; unit: (typeof UNITS)[number] };
type Material = { component: string; material: string };

export function AddVersionForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [versionType, setVersionType] = useState<(typeof VERSION_TYPES)[number]>("PROTOTYPE");
  const [changeSummary, setChangeSummary] = useState("");
  const [description, setDescription] = useState("");
  const [dimensions, setDimensions] = useState<Dimension[]>([{ name: "", value: "", unit: "mm" }]);
  const [materials, setMaterials] = useState<Material[]>([{ component: "", material: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2"
      >
        + Add Version
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/products/${productId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionType,
          description: description || undefined,
          changeSummary: changeSummary || undefined,
          dimensions: dimensions
            .filter((d) => d.name && d.value !== "")
            .map((d) => ({ name: d.name, value: Number(d.value), unit: d.unit })),
          materials: materials.filter((m) => m.component && m.material),
          finishes: [],
          components: [],
          specifications: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create version");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-lg p-5 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Version type</label>
          <select
            value={versionType}
            onChange={(e) => setVersionType(e.target.value as typeof versionType)}
            className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
          >
            {VERSION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Change summary</label>
          <input
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="What changed from the previous version?"
            className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-neutral-600">Dimensions</label>
          <button
            type="button"
            onClick={() => setDimensions([...dimensions, { name: "", value: "", unit: "mm" }])}
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            + Add dimension
          </button>
        </div>
        <div className="space-y-2">
          {dimensions.map((d, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <input
                placeholder="e.g. Seat Height"
                value={d.name}
                onChange={(e) =>
                  setDimensions(dimensions.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))
                }
                className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
              />
              <input
                type="number"
                step="any"
                placeholder="Value"
                value={d.value}
                onChange={(e) =>
                  setDimensions(dimensions.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))
                }
                className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
              />
              <select
                value={d.unit}
                onChange={(e) =>
                  setDimensions(
                    dimensions.map((x, idx) =>
                      idx === i ? { ...x, unit: e.target.value as (typeof UNITS)[number] } : x
                    )
                  )
                }
                className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-neutral-600">Materials</label>
          <button
            type="button"
            onClick={() => setMaterials([...materials, { component: "", material: "" }])}
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            + Add material
          </button>
        </div>
        <div className="space-y-2">
          {materials.map((m, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input
                placeholder="Component (e.g. Frame)"
                value={m.component}
                onChange={(e) =>
                  setMaterials(materials.map((x, idx) => (idx === i ? { ...x, component: e.target.value } : x)))
                }
                className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
              />
              <input
                placeholder="Material (e.g. Solid Oak)"
                value={m.material}
                onChange={(e) =>
                  setMaterials(materials.map((x, idx) => (idx === i ? { ...x, material: e.target.value } : x)))
                }
                className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          disabled={submitting}
          className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save version"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-neutral-300 text-sm font-medium px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
