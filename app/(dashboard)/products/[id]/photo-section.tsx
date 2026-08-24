"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnnotateModal } from "./annotate-modal";

const LOCATIONS = [
  "BACK",
  "SEAT",
  "ARMREST",
  "LEG",
  "FRAME",
  "TABLETOP",
  "EDGE",
  "JOINT",
  "SURFACE",
  "UNDERSIDE",
  "INTERIOR",
  "OTHER",
] as const;

type MediaRow = {
  id: string;
  imageType: string | null;
  description: string | null;
  locationArea: string | null;
  isMasterReference: boolean;
  uploadedAt: string;
  uploadedByName: string;
  versionNumber: string | null;
};

type VersionOption = { id: string; versionNumber: string };

export function PhotoSection({
  productId,
  canUpload,
  versions,
  initialMedia,
}: {
  productId: string;
  canUpload: boolean;
  versions: VersionOption[];
  initialMedia: MediaRow[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [locationArea, setLocationArea] = useState<(typeof LOCATIONS)[number] | "">("");
  const [productVersionId, setProductVersionId] = useState(versions[0]?.id ?? "");
  const [isMasterReference, setIsMasterReference] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [annotatingId, setAnnotatingId] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleRetake() {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (productVersionId) formData.append("productVersionId", productVersionId);
      if (description) formData.append("description", description);
      if (locationArea) formData.append("locationArea", locationArea);
      formData.append("isMasterReference", String(isMasterReference));

      const res = await fetch(`/api/v1/products/${productId}/media`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      handleRetake();
      setDescription("");
      setIsMasterReference(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          {!previewUrl ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-lg py-8 cursor-pointer hover:bg-neutral-50">
              <span className="text-sm font-medium text-neutral-700">Take or upload a photo</span>
              <span className="text-xs text-neutral-400 mt-1">Opens the camera on mobile</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a static asset */}
              <img src={previewUrl} alt="Preview" className="w-full max-h-72 object-contain rounded bg-neutral-50" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {versions.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Version</label>
                    <select
                      value={productVersionId}
                      onChange={(e) => setProductVersionId(e.target.value)}
                      className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                    >
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.versionNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Location on product</label>
                  <select
                    value={locationArea}
                    onChange={(e) => setLocationArea(e.target.value as typeof locationArea)}
                    className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                  >
                    <option value="">Not specified</option>
                    {LOCATIONS.map((l) => (
                      <option key={l} value={l}>
                        {l.charAt(0) + l.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Scratch on rear leg, approx. 120mm"
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={isMasterReference}
                  onChange={(e) => setIsMasterReference(e.target.checked)}
                />
                Mark as Master Sample reference photo
              </label>

              {error && <p className="text-sm text-red-700">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleUpload}
                  disabled={submitting}
                  className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
                >
                  {submitting ? "Uploading…" : "Save photo"}
                </button>
                <button
                  onClick={handleRetake}
                  disabled={submitting}
                  className="rounded border border-neutral-300 text-sm font-medium px-4 py-2"
                >
                  Retake
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {initialMedia.length === 0 ? (
        <p className="text-sm text-neutral-400 bg-white border border-dashed border-neutral-300 rounded-lg px-4 py-6 text-center">
          No photos yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {initialMedia.map((m) => (
            <div key={m.id} className="border border-neutral-200 rounded-lg overflow-hidden bg-white hover:shadow-sm transition-shadow">
              <a href={`/api/v1/media/${m.id}/file`} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- authenticated dynamic thumbnail from our API */}
                <img
                  src={`/api/v1/media/${m.id}/thumbnail`}
                  alt={m.description ?? "Product photo"}
                  className="w-full h-32 object-cover"
                />
              </a>
              <div className="p-2">
                {m.isMasterReference && (
                  <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 mb-1">
                    Master reference
                  </span>
                )}
                {m.locationArea && (
                  <p className="text-xs text-neutral-500">{m.locationArea.charAt(0) + m.locationArea.slice(1).toLowerCase()}</p>
                )}
                {m.description && <p className="text-xs text-neutral-700 truncate">{m.description}</p>}
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  {m.uploadedByName} · {new Date(m.uploadedAt).toLocaleDateString()}
                </p>
                {canUpload && (
                  <button
                    onClick={() => setAnnotatingId(m.id)}
                    className="mt-1.5 text-[10px] font-medium text-neutral-600 border border-neutral-300 rounded px-1.5 py-0.5 hover:bg-neutral-100"
                  >
                    Annotate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {annotatingId && (
        <AnnotateModal
          mediaId={annotatingId}
          productId={productId}
          onClose={() => setAnnotatingId(null)}
          onSaved={() => {
            setAnnotatingId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
