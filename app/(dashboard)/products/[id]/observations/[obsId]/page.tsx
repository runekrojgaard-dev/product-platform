import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions";
import { ObservationDetailClient } from "./observation-detail-client";

export default async function ObservationDetailPage({
  params,
}: {
  params: { id: string; obsId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!roleHasPermission(session.user.role, "observation.view")) redirect("/dashboard");

  const observation = await prisma.observation.findFirst({
    where: { id: params.obsId, productId: params.id },
    include: {
      product: { select: { name: true, productId: true } },
      productVersion: { select: { versionNumber: true, versionType: true } },
      createdBy: { select: { name: true } },
      assignedTo: { select: { id: true, name: true } },
      resolvedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, createdAt: true, createdBy: { select: { name: true } } },
      },
      correctiveActions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          description: true,
          status: true,
          createdAt: true,
          completedAt: true,
          assignedTo: { select: { name: true } },
        },
      },
      media: {
        select: { id: true, description: true, uploadedAt: true },
      },
    },
  });

  if (!observation) notFound();

  const assignableUsers = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6 max-w-2xl">
      <Link href={`/products/${params.id}`} className="text-xs text-neutral-500 hover:underline">
        ← {observation.product.name} ({observation.product.productId})
      </Link>

      <ObservationDetailClient
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
        assignableUsers={assignableUsers}
        observation={{
          id: observation.id,
          observationCode: observation.observationCode,
          category: observation.category,
          subcategory: observation.subcategory,
          description: observation.description,
          severity: observation.severity,
          status: observation.status,
          location: observation.location,
          locationDetail: observation.locationDetail,
          versionNumber: observation.productVersion.versionNumber,
          createdByName: observation.createdBy.name,
          createdById: observation.createdById,
          createdAt: observation.createdAt.toISOString(),
          assignedTo: observation.assignedTo,
          dueDate: observation.dueDate ? observation.dueDate.toISOString() : null,
          resolution: observation.resolution,
          resolvedByName: observation.resolvedBy?.name ?? null,
          resolvedDate: observation.resolvedDate ? observation.resolvedDate.toISOString() : null,
          approvedByName: observation.approvedBy?.name ?? null,
          approvedDate: observation.approvedDate ? observation.approvedDate.toISOString() : null,
          comments: observation.comments.map((c) => ({
            id: c.id,
            body: c.body,
            createdAt: c.createdAt.toISOString(),
            createdByName: c.createdBy.name,
          })),
          correctiveActions: observation.correctiveActions.map((ca) => ({
            id: ca.id,
            description: ca.description,
            status: ca.status,
            createdAt: ca.createdAt.toISOString(),
            completedAt: ca.completedAt ? ca.completedAt.toISOString() : null,
            assignedToName: ca.assignedTo?.name ?? null,
          })),
          mediaCount: observation.media.length,
        }}
      />
    </div>
  );
}
