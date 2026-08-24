import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions";
import { ProductsClient } from "./products-client";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!roleHasPermission(session.user.role, "product.view")) redirect("/dashboard");

  const canCreate = roleHasPermission(session.user.role, "product.create");

  const [products, projects, designers] = await Promise.all([
    prisma.product.findMany({
      where: searchParams.projectId ? { projectId: searchParams.projectId } : undefined,
      select: {
        id: true,
        productId: true,
        productNumber: true,
        name: true,
        category: true,
        status: true,
        project: { select: { name: true } },
        designer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { name: "PRODUCT_DESIGNER" }, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-lg font-semibold text-neutral-900">Products</h1>
      <p className="text-sm text-neutral-500 mt-1 mb-6">
        The Product ID is permanent once created and stays with the product through its
        entire lifecycle.
      </p>
      <ProductsClient
        canCreate={canCreate}
        initialProducts={products.map((p) => ({
          id: p.id,
          productId: p.productId,
          productNumber: p.productNumber,
          name: p.name,
          category: p.category,
          status: p.status,
          projectName: p.project.name,
          designerName: p.designer?.name ?? null,
        }))}
        projects={projects}
        designers={designers}
        preselectedProjectId={searchParams.projectId}
      />
    </div>
  );
}
