import Link from "next/link";

export default function AddPage() {
  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold text-neutral-900">Add</h1>
      <p className="text-sm text-neutral-500 mt-1 mb-4">
        Quick-add actions (observation, measurement, photo) arrive as their respective stages are built.
        For now:
      </p>
      <div className="flex flex-col gap-2 max-w-xs">
        <Link href="/products" className="text-sm font-medium px-3 py-2 rounded border border-neutral-300 text-center">
          Add Product
        </Link>
        <Link href="/projects" className="text-sm font-medium px-3 py-2 rounded border border-neutral-300 text-center">
          Add Project
        </Link>
        <Link href="/scan" className="text-sm font-medium px-3 py-2 rounded bg-neutral-900 text-white text-center">
          Scan a Product
        </Link>
      </div>
    </div>
  );
}
