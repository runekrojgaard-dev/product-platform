import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions";
import { CompareClient } from "./compare-client";

export default async function CompareVersionsPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!roleHasPermission(session.user.role, "product.view")) redirect("/dashboard");

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      productId: true,
      versions: {
        orderBy: { createdAt: "asc" },
        select: { id: true, versionNumber: true, versionType: true },
      },
    },
  });

  if (!product) notFound();

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-lg font-semibold text-neutral-900">
        Compare Versions — {product.name} ({product.productId})
      </h1>
      <p className="text-sm text-neutral-500 mt-1 mb-6">
        Select two versions to see what changed between them.
      </p>
      <CompareClient productId={product.id} versions={product.versions} />
    </div>
  );
}
