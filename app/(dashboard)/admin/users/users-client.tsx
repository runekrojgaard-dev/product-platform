"use client";

import { useState } from "react";

type RoleName =
  | "ADMINISTRATOR"
  | "PRODUCT_DESIGNER"
  | "QUALITY_CONTROL"
  | "PRODUCTION"
  | "ASSEMBLY_INSTALLATION"
  | "PROJECT_MANAGER"
  | "VIEWER";

type UserRow = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  role: RoleName;
};

export function UserManagementClient({
  initialUsers,
  availableRoles,
}: {
  initialUsers: UserRow[];
  availableRoles: RoleName[];
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: availableRoles[0] });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create user");
        return;
      }
      setUsers((prev) => [{ ...data, active: true }, ...prev]);
      setForm({ email: "", name: "", password: "", role: availableRoles[0] });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(user: UserRow) {
    const res = await fetch(`/api/v1/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, active: !u.active } : u)));
    }
  }

  async function handleRoleChange(user: UserRow, role: RoleName) {
    const res = await fetch(`/api/v1/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleCreate}
        className="bg-white border border-neutral-200 rounded-lg p-5 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
      >
        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-neutral-600 mb-1">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Temporary password</label>
          <input
            required
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as RoleName })}
            className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
          >
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-4">
          {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
          <button
            disabled={submitting}
            className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create user"}
          </button>
        </div>
      </form>

      <table className="w-full text-sm bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Name</th>
            <th className="text-left px-4 py-2 font-medium">Email</th>
            <th className="text-left px-4 py-2 font-medium">Role</th>
            <th className="text-left px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-neutral-100">
              <td className="px-4 py-2 text-neutral-900">{u.name}</td>
              <td className="px-4 py-2 text-neutral-600">{u.email}</td>
              <td className="px-4 py-2">
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u, e.target.value as RoleName)}
                  className="rounded border border-neutral-300 px-2 py-1 text-xs"
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2">
                <button
                  onClick={() => handleToggleActive(u)}
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    u.active
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-neutral-100 text-neutral-500 border border-neutral-200"
                  }`}
                >
                  {u.active ? "Active" : "Inactive"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
