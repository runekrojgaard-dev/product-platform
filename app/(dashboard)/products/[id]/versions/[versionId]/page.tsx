import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { roleHasPermission } from "@/lib/permissions";

type DimensionEntry = { name: string; value: number; unit: string };
type MaterialEntry = { component: string; material: string };
type FinishEntry = { component: string; finish: string; color?: string };
type ComponentEntry = { name: string; description?: string };
type SpecEntry = { key: string; value: string };

export default async function VersionDetailPage({
  params,
}: {
  params: { id: string; versionId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!roleHasPermission(session.user.role, "product.view")) redirect("/dashboard");

  const version = await prisma.productVersion.findFirst({
    where: { id: params.versionId, productId: params.id },
    include: {
      product: { select: { name: true, productId: true } },
      createdBy: { select: { name: true } },
      masterSample: true,
    },
  });

  if (!version) notFound();

  const dimensions = (version.dimensions as unknown as DimensionEntry[]) ?? [];
  const materials = (version.materials as unknown as MaterialEntry[]) ?? [];
  const finishes = (version.finishes as unknown as FinishEntry[]) ?? [];
  const components = (version.components as unknown as ComponentEntry[]) ?? [];
  const specifications = (version.specifications as unknown as SpecEntry[]) ?? [];

  return (
    <div className="p-6 max-w-3xl">
      <Link href={`/products/${params.id}`} className="text-xs text-neutral-500 hover:underline">
        ← {version.product.name} ({version.product.productId})
      </Link>

      <div className="flex items-center gap-3 mt-2 mb-1">
        <h1 className="text-lg font-semibold text-neutral-900">
          {version.versionNumber} — {version.versionType.replace(/_/g, " ")}
        </h1>
        {version.masterSample && (
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
            {version.masterSample.masterVersionNumber}
          </span>
        )}
      </div>
      <p className="text-sm text-neutral-500 mb-6">
        Created {version.createdAt.toLocaleDateString()} by {version.createdBy.name}
      </p>

      {version.changeSummary && (
        <p className="text-sm text-neutral-700 bg-neutral-100 rounded px-3 py-2 mb-6">
          {version.changeSummary}
        </p>
      )}
      {version.description && <p className="text-sm text-neutral-700 mb-6">{version.description}</p>}

      <Section title="Dimensions">
        {dimensions.length === 0 ? (
          <Empty />
        ) : (
          <Table
            headers={["Dimension", "Value", "Unit"]}
            rows={dimensions.map((d) => [d.name, d.value.toString(), d.unit])}
          />
        )}
      </Section>

      <Section title="Materials">
        {materials.length === 0 ? (
          <Empty />
        ) : (
          <Table
            headers={["Component", "Material"]}
            rows={materials.map((m) => [m.component, m.material])}
          />
        )}
      </Section>

      <Section title="Finishes">
        {finishes.length === 0 ? (
          <Empty />
        ) : (
          <Table
            headers={["Component", "Finish", "Color"]}
            rows={finishes.map((f) => [f.component, f.finish, f.color ?? "—"])}
          />
        )}
      </Section>

      <Section title="Components">
        {components.length === 0 ? (
          <Empty />
        ) : (
          <Table
            headers={["Name", "Description"]}
            rows={components.map((c) => [c.name, c.description ?? "—"])}
          />
        )}
      </Section>

      <Section title="Other Specifications">
        {specifications.length === 0 ? (
          <Empty />
        ) : (
          <Table headers={["Key", "Value"]} rows={specifications.map((s) => [s.key, s.value])} />
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-neutral-900 mb-2">{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-neutral-400">Not recorded for this version.</p>;
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table className="w-full text-sm bg-white border border-neutral-200 rounded-lg overflow-hidden">
      <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
        <tr>
          {headers.map((h) => (
            <th key={h} className="text-left px-4 py-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-neutral-100">
            {row.map((cell, j) => (
              <td key={j} className="px-4 py-2 text-neutral-800">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
