import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions";
import { AddVersionForm } from "./add-version-form";
import { MasterSampleSection } from "./master-sample-section";
import { ProductionBatchSection } from "./production-batch-section";
import { ProductQrCode } from "./product-qr-code";
import { PhotoSection } from "./photo-section";
import { ObservationsSection } from "./observations-section";
import { MeasurementsSection } from "./measurements-section";

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!roleHasPermission(session.user.role, "product.view")) redirect("/dashboard");

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { name: true, customer: { select: { name: true } } } },
      designer: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
      versions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          versionNumber: true,
          versionType: true,
          changeSummary: true,
          createdAt: true,
          createdBy: { select: { name: true } },
          masterSample: { select: { id: true, masterVersionNumber: true, isCurrent: true, approvalStatus: true } },
        },
      },
      masterSamples: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          masterVersionNumber: true,
          approvalStatus: true,
          approvedDate: true,
          approvalComments: true,
          isCurrent: true,
          approvedBy: { select: { name: true } },
          productVersion: { select: { versionNumber: true, versionType: true } },
        },
      },
      productionBatches: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          batchCode: true,
          productionDate: true,
          productionLocation: true,
          supplier: true,
          quantity: true,
          status: true,
          notes: true,
          productionManager: { select: { name: true } },
          masterSample: { select: { masterVersionNumber: true } },
        },
      },
      media: {
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          imageType: true,
          description: true,
          locationArea: true,
          isMasterReference: true,
          uploadedAt: true,
          uploadedBy: { select: { name: true } },
          productVersion: { select: { versionNumber: true } },
        },
      },
      observations: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          observationCode: true,
          category: true,
          description: true,
          severity: true,
          status: true,
          location: true,
          createdAt: true,
          dueDate: true,
          createdBy: { select: { name: true } },
          assignedTo: { select: { name: true } },
          productVersion: { select: { versionNumber: true } },
        },
      },
    },
  });
  if (!product) notFound();

  const canCreateVersion = roleHasPermission(session.user.role, "product.version.create");
  const canPropose = roleHasPermission(session.user.role, "product.mastersample.propose");
  const canApprove = roleHasPermission(session.user.role, "product.mastersample.approve");
  const canManageBatches = roleHasPermission(session.user.role, "production.batch.manage");
  const canUploadMedia = roleHasPermission(session.user.role, "media.upload");
  const canCreateObservation = roleHasPermission(session.user.role, "observation.create");
  const canRecordMeasurement = roleHasPermission(session.user.role, "measurement.record");

  const [defectCategories, assignableUsers, measurements] = await Promise.all([
    prisma.defectCategory.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.measurement.findMany({
      where: {
        OR: [
          { productVersion: { productId: params.id } },
          { masterSample: { productId: params.id } },
          { productionBatch: { productId: params.id } },
          { observation: { productId: params.id } },
        ],
      },
      select: {
        id: true,
        name: true,
        unit: true,
        referenceValue: true,
        toleranceLower: true,
        toleranceUpper: true,
        measuredValue: true,
        result: true,
        notes: true,
        createdAt: true,
        productVersion: { select: { versionNumber: true } },
        masterSample: { select: { masterVersionNumber: true } },
        productionBatch: { select: { batchCode: true } },
        observation: { select: { observationCode: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const approvedMasterSamples = product.masterSamples
    .filter((m) => m.approvalStatus === "APPROVED")
    .map((m) => ({ id: m.id, masterVersionNumber: m.masterVersionNumber, isCurrent: m.isCurrent }));

  const versionsWithoutMaster = product.versions
    .filter((v) => !v.masterSample)
    .map((v) => ({ id: v.id, versionNumber: v.versionNumber, versionType: v.versionType }));

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-semibold text-neutral-900">{product.name}</h1>
        <span className="font-mono text-xs text-neutral-500">{product.productId}</span>
      </div>
      <p className="text-sm text-neutral-500 mb-4">
        {product.project.customer.name} — {product.project.name}
      </p>

      {/* Primary mobile-relevant actions, per Section 9 quick-view spec.
          Add Observation / Take Photo / Add Measurement are wired up once
          Stages 9–11 exist; shown disabled rather than hidden so the shape
          of the eventual mobile flow is visible now. */}
      <div className="flex flex-wrap gap-2 mb-6">
        <a
          href="#version-history"
          className="text-xs font-medium px-3 py-1.5 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
        >
          View History
        </a>
        <a
          href="#master-samples"
          className="text-xs font-medium px-3 py-1.5 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
        >
          View Master Sample
        </a>
        <a
          href="#observations"
          className="text-xs font-medium px-3 py-1.5 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
        >
          Add Observation
        </a>
        <a
          href="#photos"
          className="text-xs font-medium px-3 py-1.5 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
        >
          Take Photo
        </a>
        <a
          href="#measurements"
          className="text-xs font-medium px-3 py-1.5 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
        >
          Add Measurement
        </a>
      </div>

      <div className="mb-8">
        <ProductQrCode productId={product.productId} dbId={product.id} />
      </div>

      <dl className="bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100 mb-8">
        <Row label="Product Number" value={product.productNumber} />
        <Row label="Category" value={product.category} />
        <Row label="Designer" value={product.designer?.name ?? "Unassigned"} />
        <Row label="Status" value={product.status.replace(/_/g, " ")} />
        <Row
          label="Tags"
          value={product.tags.length ? product.tags.map((t) => t.tag.name).join(", ") : "—"}
        />
        <Row label="Created" value={product.createdAt.toLocaleDateString()} />
      </dl>

      <div id="version-history" className="flex items-center justify-between mb-3 scroll-mt-4">
        <h2 className="text-sm font-semibold text-neutral-900">Version History</h2>
        {product.versions.length >= 2 && (
          <Link
            href={`/products/${product.id}/compare`}
            className="text-xs font-medium text-neutral-700 border border-neutral-300 rounded px-2.5 py-1 hover:bg-neutral-100"
          >
            Compare Versions
          </Link>
        )}
      </div>

      <ol className="mb-8">
        {product.versions.length === 0 && (
          <li className="text-sm text-neutral-400 bg-white border border-dashed border-neutral-300 rounded-lg px-4 py-6 text-center">
            No versions yet — create the first prototype below.
          </li>
        )}
        {product.versions.map((v, i) => (
          <li key={v.id} className="relative pl-6 pb-4">
            {i < product.versions.length - 1 && (
              <span className="absolute left-[7px] top-4 bottom-0 w-px bg-neutral-200" />
            )}
            <span className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-neutral-900" />
            <div className="bg-white border border-neutral-200 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between">
                <Link
                  href={`/products/${product.id}/versions/${v.id}`}
                  className="text-sm font-medium text-neutral-900 hover:underline"
                >
                  {v.versionNumber} — {v.versionType.replace(/_/g, " ")}
                </Link>
                <span className="text-xs text-neutral-400">{v.createdAt.toLocaleDateString()}</span>
              </div>
              {v.masterSample && (
                <span
                  className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded border ${
                    v.masterSample.approvalStatus === "APPROVED"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : v.masterSample.approvalStatus === "REJECTED"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-yellow-50 text-yellow-700 border-yellow-200"
                  }`}
                >
                  {v.masterSample.masterVersionNumber}
                  {v.masterSample.isCurrent ? " (current)" : ` (${v.masterSample.approvalStatus.toLowerCase()})`}
                </span>
              )}
              {v.changeSummary && <p className="text-sm text-neutral-600 mt-1">{v.changeSummary}</p>}
              <p className="text-xs text-neutral-400 mt-1">by {v.createdBy.name}</p>
            </div>
          </li>
        ))}
      </ol>

      {canCreateVersion && <AddVersionForm productId={product.id} />}

      <div id="master-samples" className="mt-10 scroll-mt-4">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Master Samples</h2>
        <MasterSampleSection
          productId={product.id}
          canPropose={canPropose}
          canApprove={canApprove}
          versionsWithoutMaster={versionsWithoutMaster}
          initialMasterSamples={product.masterSamples.map((m) => ({
            id: m.id,
            masterVersionNumber: m.masterVersionNumber,
            approvalStatus: m.approvalStatus,
            approvedDate: m.approvedDate ? m.approvedDate.toISOString() : null,
            approvalComments: m.approvalComments,
            isCurrent: m.isCurrent,
            approvedByName: m.approvedBy?.name ?? null,
            versionNumber: m.productVersion.versionNumber,
            versionType: m.productVersion.versionType,
          }))}
        />
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Production Batches</h2>
        <ProductionBatchSection
          productId={product.id}
          canManage={canManageBatches}
          approvedMasterSamples={approvedMasterSamples}
          initialBatches={product.productionBatches.map((b) => ({
            id: b.id,
            batchCode: b.batchCode,
            productionDate: b.productionDate.toISOString(),
            productionLocation: b.productionLocation,
            supplier: b.supplier,
            quantity: b.quantity,
            status: b.status,
            notes: b.notes,
            productionManagerName: b.productionManager?.name ?? null,
            masterVersionNumber: b.masterSample.masterVersionNumber,
          }))}
        />
      </div>

      <div id="photos" className="mt-10 scroll-mt-4">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Photos</h2>
        <PhotoSection
          productId={product.id}
          canUpload={canUploadMedia}
          versions={product.versions.map((v) => ({ id: v.id, versionNumber: v.versionNumber }))}
          initialMedia={product.media.map((m) => ({
            id: m.id,
            imageType: m.imageType,
            description: m.description,
            locationArea: m.locationArea,
            isMasterReference: m.isMasterReference,
            uploadedAt: m.uploadedAt.toISOString(),
            uploadedByName: m.uploadedBy.name,
            versionNumber: m.productVersion?.versionNumber ?? null,
          }))}
        />
      </div>

      <div id="observations" className="mt-10 scroll-mt-4">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Quality Observations</h2>
        <ObservationsSection
          productId={product.id}
          canCreate={canCreateObservation}
          categories={defectCategories.map((c) => c.name)}
          versions={product.versions.map((v) => ({ id: v.id, versionNumber: v.versionNumber }))}
          assignableUsers={assignableUsers}
          initialObservations={product.observations.map((o) => ({
            id: o.id,
            observationCode: o.observationCode,
            category: o.category,
            description: o.description,
            severity: o.severity,
            status: o.status,
            location: o.location,
            createdAt: o.createdAt.toISOString(),
            dueDate: o.dueDate ? o.dueDate.toISOString() : null,
            createdByName: o.createdBy.name,
            assignedToName: o.assignedTo?.name ?? null,
            versionNumber: o.productVersion.versionNumber,
          }))}
        />
      </div>

      <div id="measurements" className="mt-10 scroll-mt-4">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Measurements</h2>
        <MeasurementsSection
          productId={product.id}
          canRecord={canRecordMeasurement}
          versions={product.versions.map((v) => ({ id: v.id, versionNumber: v.versionNumber }))}
          masterSamples={product.masterSamples
            .filter((m) => m.approvalStatus === "APPROVED")
            .map((m) => ({ id: m.id, label: m.masterVersionNumber }))}
          productionBatches={product.productionBatches.map((b) => ({ id: b.id, label: b.batchCode }))}
          observations={product.observations.map((o) => ({ id: o.id, label: o.observationCode }))}
          initialMeasurements={measurements.map((m) => ({
            id: m.id,
            name: m.name,
            unit: m.unit,
            referenceValue: m.referenceValue,
            toleranceLower: m.toleranceLower,
            toleranceUpper: m.toleranceUpper,
            measuredValue: m.measuredValue,
            result: m.result,
            notes: m.notes,
            createdAt: m.createdAt.toISOString(),
            context:
              m.masterSample?.masterVersionNumber ??
              m.productionBatch?.batchCode ??
              m.observation?.observationCode ??
              m.productVersion?.versionNumber ??
              "—",
          }))}
        />
      </div>

      <div className="mt-8 p-4 border border-dashed border-neutral-300 rounded-lg text-sm text-neutral-500">
        This covers the full MVP scope from Section 35 of the brief. Remaining
        polish items (dashboard charts, PDF reports, global search, and the
        Master vs. Production comparison view linked from each production
        batch above) round out Stages 13–17.
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex px-4 py-3 text-sm">
      <dt className="w-40 text-neutral-500">{label}</dt>
      <dd className="text-neutral-900">{value}</dd>
    </div>
  );
}
