"use client";

import { useState } from "react";
import Link from "next/link";

type SearchResults = {
  products: { id: string; productId: string; name: string; category: string }[];
  projects: { id: string; name: string; customer: { name: string } }[];
  batches: { id: string; batchCode: string; supplier: string | null; product: { id: string; name: string } }[];
  observations: {
    id: string;
    observationCode: string;
    category: string;
    status: string;
    product: { id: string; name: string };
  }[];
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok) setResults(data);
    } finally {
      setLoading(false);
    }
  }

  const hasResults =
    results &&
    (results.products.length ||
      results.projects.length ||
      results.batches.length ||
      results.observations.length);

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-neutral-900 mb-1">Search</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Search products, projects, production batches, and observations.
      </p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Product ID, name, batch code, observation..."
          className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          disabled={loading}
          className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {results && !hasResults && (
        <p className="text-sm text-neutral-400 text-center py-8">No results for &ldquo;{query}&rdquo;.</p>
      )}

      {results && results.products.length > 0 && (
        <ResultSection title="Products">
          {results.products.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="block bg-white border border-neutral-200 rounded-lg px-4 py-2.5 hover:shadow-sm"
            >
              <span className="font-mono text-xs text-neutral-500 mr-2">{p.productId}</span>
              <span className="text-sm text-neutral-900">{p.name}</span>
              <span className="text-xs text-neutral-400 ml-2">{p.category}</span>
            </Link>
          ))}
        </ResultSection>
      )}

      {results && results.observations.length > 0 && (
        <ResultSection title="Observations">
          {results.observations.map((o) => (
            <Link
              key={o.id}
              href={`/products/${o.product.id}/observations/${o.id}`}
              className="block bg-white border border-neutral-200 rounded-lg px-4 py-2.5 hover:shadow-sm"
            >
              <span className="font-mono text-xs text-neutral-500 mr-2">{o.observationCode}</span>
              <span className="text-sm text-neutral-900">{o.category}</span>
              <span className="text-xs text-neutral-400 ml-2">
                {o.product.name} · {o.status.replace(/_/g, " ")}
              </span>
            </Link>
          ))}
        </ResultSection>
      )}

      {results && results.batches.length > 0 && (
        <ResultSection title="Production Batches">
          {results.batches.map((b) => (
            <Link
              key={b.id}
              href={`/products/${b.product.id}/production-batches/${b.id}/compare`}
              className="block bg-white border border-neutral-200 rounded-lg px-4 py-2.5 hover:shadow-sm"
            >
              <span className="font-mono text-xs text-neutral-500 mr-2">{b.batchCode}</span>
              <span className="text-sm text-neutral-900">{b.product.name}</span>
              {b.supplier && <span className="text-xs text-neutral-400 ml-2">{b.supplier}</span>}
            </Link>
          ))}
        </ResultSection>
      )}

      {results && results.projects.length > 0 && (
        <ResultSection title="Projects">
          {results.projects.map((p) => (
            <Link
              key={p.id}
              href={`/products?projectId=${p.id}`}
              className="block bg-white border border-neutral-200 rounded-lg px-4 py-2.5 hover:shadow-sm"
            >
              <span className="text-sm text-neutral-900">{p.name}</span>
              <span className="text-xs text-neutral-400 ml-2">{p.customer.name}</span>
            </Link>
          ))}
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
