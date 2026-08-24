import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions";
import { ProjectsClient } from "./projects-client";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!roleHasPermission(session.user.role, "project.view")) redirect("/dashboard");

  const canManage = roleHasPermission(session.user.role, "project.manage");

  const [projects, customers] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        customer: { select: { name: true } },
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-lg font-semibold text-neutral-900">Projects</h1>
      <p className="text-sm text-neutral-500 mt-1 mb-6">
        Every product belongs to a project, which belongs to a customer.
      </p>
      <ProjectsClient
        canManage={canManage}
        initialProjects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          customerName: p.customer.name,
          productCount: p._count.products,
        }))}
        customers={customers}
      />
    </div>
  );
}
