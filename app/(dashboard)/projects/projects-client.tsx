ª"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [customerList, setCustomerList] = useState(customers);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [form, setForm] = useState({ name: "", customerId: customers[0]?.id ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showImport, setShowImport] = useState(false);

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
        <div className="flex justify-end">
          <button
            onClick={() => setShowImport(true)}
            className="text-xs font-medium text-neutral-700 border border-neutral-300 rounded px-3 py-1.5 hover:bg-neutral-100"
          >
            Import from Excel
          </button>
        </div>
      )}

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

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    createdProjectsCount: number;
    createdProjects: string[];
    createdProductsCount: number;
    createdProducts: string[];
    photosAttached: number;
    skipped: { rowNumber: number; reason: string }[];
    parseErrors: { rowNumber: number; message: string }[];
  } | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/projects/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
        return;
      }
      setResult(data);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-900">Import Projects from Excel</h3>
          <button onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-900">
            Close
          </button>
        </div>

        {!result && (
          <>
            <p className="text-sm text-neutral-500 mb-3">
              Upload an .xlsx file with columns <strong>Project Name</strong>, <strong>Customer</strong>,
              and optionally <strong>Status</strong> (Active / On Hold / Completed / Cancelled — defaults
              to Active). Customers that don&apos;t exist yet are created automatically.
            </p>
            <p className="text-sm text-neutral-500 mb-3">
              To also create products, add columns <strong>Product Number</strong>,{" "}
              <strong>Product Name</strong>, and <strong>Category</strong> (all three together). If you
              paste a photo directly into a row&apos;s cells in Excel, it&apos;s automatically attached to
              that row&apos;s product as a reference photo.
            </p>
            <p className="text-xs text-neutral-400 mb-3">
              Re-uploading a sheet won&apos;t create duplicates — existing projects and products (matched
              by name/number) are skipped.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm mb-3"
            />
            {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
            >
              {uploading ? "Importing…" : "Import"}
            </button>
          </>
        )}

        {result && (
          <div className="space-y-3">
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              Created {result.createdProjectsCount} project{result.createdProjectsCount === 1 ? "" : "s"},{" "}
              {result.createdProductsCount} product{result.createdProductsCount === 1 ? "" : "s"}
              {result.photosAttached > 0 &&
                ` (${result.photosAttached} with a photo attached)`}
              .
            </p>
            {result.skipped.length > 0 && (
              <div>
                <p className="text-xs font-medium text-neutral-600 mb-1">
                  Skipped ({result.skipped.length}) — already existed:
                </p>
                <ul className="text-xs text-neutral-500 space-y-0.5 max-h-32 overflow-y-auto">
                  {result.skipped.map((s, i) => (
                    <li key={i}>
                      Row {s.rowNumber}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.parseErrors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 mb-1">
                  Rows with errors ({result.parseErrors.length}):
                </p>
                <ul className="text-xs text-red-500 space-y-0.5 max-h-32 overflow-y-auto">
                  {result.parseErrors.map((e, i) => (
                    <li key={i}>
                      Row {e.rowNumber}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={onImported}
              className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
