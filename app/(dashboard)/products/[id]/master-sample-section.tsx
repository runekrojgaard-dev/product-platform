"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type MasterSampleRow = {
  id: string;
  masterVersionNumber: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvedDate: string | null;
  approvalComments: string | null;
  isCurrent: boolean;
  approvedByName: string | null;
  versionNumber: string;
  versionType: string;
};

type VersionOption = { id: string; versionNumber: string; versionType: string };

const STATUS_STYLES: Record<MasterSampleRow["approvalStatus"], string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

export function MasterSampleSection({
  productId,
  canPropose,
  canApprove,
  versionsWithoutMaster,
  initialMasterSamples,
}: {
  productId: string;
  canPropose: boolean;
  canApprove: boolean;
  versionsWithoutMaster: VersionOption[];
  initialMasterSamples: MasterSampleRow[];
}) {
  const router = useRouter();
  const samples = initialMasterSamples;
  const [selectedVersionId, setSelectedVersionId] = useState(versionsWithoutMaster[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handlePropose() {
    if (!selectedVersionId) return;
    setError(null);
    const res = await fetch(`/api/v1/products/${productId}/master-samples`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productVersionId: selectedVersionId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to propose Master Sample");
      return;
    }
    router.refresh();
  }

  async function handleDecision(id: string, decision: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      const comments =
        decision === "reject"
          ? window.prompt("Reason for rejection (optional):") ?? undefined
          : undefined;
      const res = await fetch(`/api/v1/master-samples/${id}/${decision}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Failed to ${decision} Master Sample`);
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {canPropose && versionsWithoutMaster.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Propose a version as Master Sample
            </label>
            <select
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
            >
              {versionsWithoutMaster.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.versionNumber} — {v.versionType.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handlePropose}
            className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2"
          >
            Propose
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      {samples.length === 0 ? (
        <p className="text-sm text-neutral-400 bg-white border border-dashed border-neutral-300 rounded-lg px-4 py-6 text-center">
          No Master Sample has been proposed yet.
        </p>
      ) : (
        <div className="space-y-2">
          {samples.map((m) => (
            <div key={m.id} className="bg-white border border-neutral-200 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-900">{m.masterVersionNumber}</span>
                  <span className="text-xs text-neutral-500">
                    ({m.versionNumber} — {m.versionType.replace(/_/g, " ")})
                  </span>
                  {m.isCurrent && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                      Current production reference
                    </span>
                  )}
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded border ${STATUS_STYLES[m.approvalStatus]}`}
                >
                  {m.approvalStatus}
                </span>
              </div>

              {m.approvalComments && (
                <p className="text-sm text-neutral-600 mt-1">&ldquo;{m.approvalComments}&rdquo;</p>
              )}
              {m.approvedByName && m.approvedDate && (
                <p className="text-xs text-neutral-400 mt-1">
                  {m.approvalStatus === "REJECTED" ? "Rejected" : "Approved"} by {m.approvedByName} on{" "}
                  {new Date(m.approvedDate).toLocaleDateString()}
                </p>
              )}

              {canApprove && m.approvalStatus === "PENDING" && (
                <div className="flex gap-2 mt-3">
                  <button
                    disabled={busyId === m.id}
                    onClick={() => handleDecision(m.id, "approve")}
                    className="text-xs font-medium px-3 py-1.5 rounded bg-green-600 text-white disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busyId === m.id}
                    onClick={() => handleDecision(m.id, "reject")}
                    className="text-xs font-medium px-3 py-1.5 rounded border border-neutral-300 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
