"use client";

import { useState } from "react";
import Link from "next/link";

type Status = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

type ProjectRow = {
  id: string;
  name: string;
  status: Status;
  customerName: string;
  productCount: number;
};

type Customer = { id: string; name: string };

const STATUS_STYLES: Record<Status, string> = {
  ACTIVE: "bg-green-50 text-green-700 border-green-200",
  ON_HOLD: "bg-yellow-50 text-yellow-700 border-yellow-200",
  COMPLETED: "bg-neutral-100 text-neutral-600 border-neutral-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

export function ProjectsClient({
  canManage,
  initialProjects,
  customers,
}: {
  canManage: boolean;
  initialProjects: ProjectRow[];
  customers: Customer[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [customerList, setCustomerList] = useState(customers);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [form, setForm] = useState({ name: "", customerId: customers[0]?.id ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateCustomer() {
    if (!newCustomerName.trim()) return;
    const res = await fetch("/api/v1/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCustomerName.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setCustomerList((prev) => [...prev, { id: data.id, name: data.name }]);
      setForm((f) => ({ ...f, customerId: data.id }));
      setNewCustomerName("");
      setShowNewCustomer(false);
    } else {
      setError(data.error || "Failed to create customer");
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create project");
        return;
      }
      const customerName = customerList.find((c) => c.id === form.customerId)?.name ?? "";
      setProjects((prev) => [
        { id: data.id, name: data.name, status: data.status, customerName, productCount: 0 },
        ...prev,
      ]);
      setForm({ name: "", customerId: customers[0]?.id ?? "" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {canManage && (
        <form
          onSubmit={handleCreateProject}
          className="bg-white border border-neutral-200 rounded-lg p-5 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Project name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Customer</label>
              {customerList.length === 0 || showNewCustomer ? (
                <div className="flex gap-2">
                  <input
                    placeholder="New customer name"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="flex-1 rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCustomer}
                    className="text-xs px-2 py-1 rounded border border-neutral-300"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  value={form.customerId}
                  onChange={(e) =>
                    e.target.value === "__new__"
                      ? setShowNewCustomer(true)
                      : setForm({ ...form, customerId: e.target.value })
                  }
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                >
                  {customerList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__new__">+ New customer…</option>
                </select>
              )}
            </div>
            <div>
              <button
                disabled={submitting || !form.customerId}
                className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create project"}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </form>
      )}

      <table className="w-full text-sm bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Project</th>
            <th className="text-left px-4 py-2 font-medium">Customer</th>
            <th className="text-left px-4 py-2 font-medium">Status</th>
            <th className="text-left px-4 py-2 font-medium">Products</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-t border-neutral-100">
              <td className="px-4 py-2 text-neutral-900">
                <Link href={`/products?projectId=${p.id}`} className="hover:underline">
                  {p.name}
                </Link>
              </td>
              <td className="px-4 py-2 text-neutral-600">{p.customerName}</td>
              <td className="px-4 py-2">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded border ${STATUS_STYLES[p.status]}`}
                >
                  {p.status.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-2 text-neutral-600">{p.productCount}</td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-neutral-400 text-sm">
                No projects yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
