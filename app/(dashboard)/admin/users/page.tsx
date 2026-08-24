import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions";
import { UserManagementClient } from "./users-client";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!roleHasPermission(session.user.role, "admin.users.manage")) {
    redirect("/dashboard");
  }

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        createdAt: true,
        role: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">User Administration</h1>
        {roleHasPermission(session.user.role, "audit.view") && (
          <Link
            href="/admin/audit-log"
            className="text-xs font-medium text-neutral-700 border border-neutral-300 rounded px-2.5 py-1 hover:bg-neutral-100"
          >
            View Audit Log
          </Link>
        )}
      </div>
      <p className="text-sm text-neutral-500 mt-1 mb-6">
        Create users and assign roles. Role changes are recorded in the audit log.
      </p>

      <UserManagementClient
        initialUsers={users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          active: u.active,
          role: u.role.name,
        }))}
        availableRoles={roles.map((r) => r.name)}
      />
    </div>
  );
}
