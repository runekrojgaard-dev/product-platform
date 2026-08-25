import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions";
import { computeMeasurementResult } from "@/lib/measurement-tolerance";

const RESULT_STYLES: Record<string, string> = {
  PASS: "bg-green-50 text-green-700 border-green-200",
  WARNING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  FAIL: "bg-red-50 text-red-700 border-red-200",
};

export default async function ProductionComparisonPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string; batchId: string }>;
}) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!roleHasPermission(session.user.role, "product.view")) redirect("/dashboard");

  const batch = await prisma.productionBatch.findFirst({
    where: { id: params.batchId, productId: params.id },
    include: {
      product: { select: { name: true, productId: true } },
      masterSample: {
        select: {
          masterVersionNumber: true,
          productVersion: {
            select: {
              versionNumber: true,
              dimensions: true,
              materials: true,
              finishes: true,
            },
          },
        },
      },
    },
  });

  if (!batch) notFound();

  const [masterMeasurements, batchMeasurements] = await Promise.all([
    prisma.measurement.findMany({
      where: { masterSampleId: batch.masterSampleId },
      select: { name: true, unit: true, referenceValue: true, toleranceLower: true, toleranceUpper: true, measuredValue: true },
    }),
    prisma.measurement.findMany({
      where: { productionBatchId: batch.id },
      select: { name: true, unit: true, measuredValue: true, result: true },
    }),
  ]);

  const masterByName = new Map(masterMeasurements.map((m) => [m.name, m]));
  const batchByName = new Map(batchMeasurements.map((m) => [m.name, m]));
  const allNames = [...new Set([...masterByName.keys(), ...batchByName.keys()])].sort();

  return (
    <div className="p-6 max-w-3xl">
      <Link href={`/products/${params.id}`} className="text-xs text-neutral-500 hover:underline">
        ← {batch.product.name} ({batch.product.productId})
      </Link>

      <h1 className="text-lg font-semibold text-neutral-900 mt-2 mb-1">
        Master vs. Production — {batch.batchCode}
      </h1>
      <p className="text-sm text-neutral-500 mb-6">
        Comparing against {batch.masterSample.masterVersionNumber} ({batch.masterSample.productVersion.versionNumber})
      </p>

      {allNames.length === 0 ? (
        <p className="text-sm text-neutral-400 bg-white border border-dashed border-neutral-300 rounded-lg px-4 py-6 text-center">
          No measurements recorded yet for either the Master Sample or this batch.
        </p>
      ) : (
        <table className="w-full text-sm bg-white border border-neutral-200 rounded-lg overflow-hidden mb-8">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Measurement</th>
              <th className="text-left px-4 py-2 font-medium">Master Sample</th>
              <th className="text-left px-4 py-2 font-medium">Production</th>
              <th className="text-left px-4 py-2 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {allNames.map((name) => {
              const master = masterByName.get(name);
              const production = batchByName.get(name);
              // Re-derive result using the Master Sample's own tolerance
              // against the production value, in case production recorded
              // the raw measured value without repeating the tolerance
              // fields — the Master Sample is always the authority for what
              // "in tolerance" means (Rule 3).
              const result =
                master && production
                  ? computeMeasurementResult(master.referenceValue, master.toleranceLower, master.toleranceUpper, production.measuredValue)
                  : production?.result;

              return (
                <tr key={name} className="border-t border-neutral-100">
                  <td className="px-4 py-2 text-neutral-900">{name}</td>
                  <td className="px-4 py-2 text-neutral-600">
                    {master ? `${master.referenceValue} ${master.unit}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-neutral-800 font-medium">
                    {production ? `${production.measuredValue} ${production.unit}` : "Not measured"}
                  </td>
                  <td className="px-4 py-2">
                    {result ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded border ${RESULT_STYLES[result]}`}>
                        {result}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="text-sm text-neutral-500 bg-neutral-100 rounded-lg px-4 py-3">
        For a materials, finishes, and photo comparison against the Master
        Sample&apos;s approved specification, see{" "}
        <Link href={`/products/${params.id}/compare`} className="underline">
          Compare Versions
        </Link>{" "}
        using {batch.masterSample.productVersion.versionNumber} as one side.
      </p>
    </div>
  );
}
