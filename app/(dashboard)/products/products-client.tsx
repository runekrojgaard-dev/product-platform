"use client";

import { useState } from "react";
import Link from "next/link";

type ProductRow = {
  id: string;
  productId: string;
  productNumber: string;
  name: string;
  category: string;
  status: string;
  projectName: string;
  designerName: string | null;
};

type Option = { id: string; name: string };

export function ProductsClient({
  canCreate,
  initialProducts,
  projects,
  designers,
  preselectedProjectId,
}: {
  canCreate: boolean;
  initialProducts: ProductRow[];
  projects: Option[];
  designers: Option[];
  preselectedProjectId?: string;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [form, setForm] = useState({
    name: "",
    productNumber: "",
    category: "",
    projectId: preselectedProjectId ?? projects[0]?.id ?? "",
    designerId: designers[0]?.id ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          designerId: form.designerId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create product");
        return;
      }
      const projectName = projects.find((p) => p.id === form.projectId)?.name ?? "";
      const designerName = designers.find((d) => d.id === form.designerId)?.name ?? null;
      setProducts((prev) => [
        {
          id: data.id,
          productId: data.productId,
          productNumber: data.productNumber,
          name: data.name,
          category: data.category,
          status: data.status,
          projectName,
          designerName,
        },
        ...prev,
      ]);
      setForm({ ...form, name: "", productNumber: "", category: "" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {canCreate && projects.length > 0 && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-neutral-200 rounded-lg p-5 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Product name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Product number</label>
            <input
              required
              placeholder="e.g. CHAIR-X"
              value={form.productNumber}
              onChange={(e) => setForm({ ...form, productNumber: e.target.value })}
              className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Category</label>
            <input
              required
              placeholder="e.g. Chair"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Project</label>
            <select
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Designer</label>
            <select
              value={form.designerId}
              onChange={(e) => setForm({ ...form, designerId: e.target.value })}
              className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
            >
              <option value="">Unassigned</option>
              {designers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-5">
            {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
            <button
              disabled={submitting}
              className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create product"}
            </button>
          </div>
        </form>
      )}

      {canCreate && projects.length === 0 && (
        <p className="text-sm text-neutral-500">
          Create a project first — every product must belong to one.
        </p>
      )}

      <table className="w-full text-sm bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Product ID</th>
            <th className="text-left px-4 py-2 font-medium">Name</th>
            <th className="text-left px-4 py-2 font-medium">Category</th>
            <th className="text-left px-4 py-2 font-medium">Project</th>
            <th className="text-left px-4 py-2 font-medium">Designer</th>
            <th className="text-left px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-t border-neutral-100">
              <td className="px-4 py-2 font-mono text-xs text-neutral-900">
                <Link href={`/products/${p.id}`} className="hover:underline">
                  {p.productId}
                </Link>
              </td>
              <td className="px-4 py-2 text-neutral-900">{p.name}</td>
              <td className="px-4 py-2 text-neutral-600">{p.category}</td>
              <td className="px-4 py-2 text-neutral-600">{p.projectName}</td>
              <td className="px-4 py-2 text-neutral-600">{p.designerName ?? "—"}</td>
              <td className="px-4 py-2">
                <span className="text-xs font-medium px-2 py-1 rounded border bg-neutral-50 text-neutral-700 border-neutral-200">
                  {p.status.replace(/_/g, " ")}
                </span>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-neutral-400 text-sm">
                No products yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
