import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions";
import { AuditLogClient } from "./audit-log-client";

export default async function AuditLogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!roleHasPermission(session.user.role, "audit.view")) redirect("/dashboard");

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      select: {
        id: true,
        action: true,
        objectType: true,
        objectId: true,
        previousValue: true,
        newValue: true,
        createdAt: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.auditLog.count(),
  ]);

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-lg font-semibold text-neutral-900">Audit Log</h1>
      <p className="text-sm text-neutral-500 mt-1 mb-6">
        Every create, status change, and approval across the system, in one append-only record.
      </p>
      <AuditLogClient
        initialEntries={entries.map((e) => ({
          id: e.id,
          action: e.action,
          objectType: e.objectType,
          objectId: e.objectId,
          previousValue: e.previousValue,
          newValue: e.newValue,
          createdAt: e.createdAt.toISOString(),
          userName: e.user.name,
        }))}
        total={total}
      />
    </div>
  );
}
