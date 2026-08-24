"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALLOWED_TRANSITIONS, requiresApprovalPermission, type ObservationStatus } from "@/lib/observation-workflow";
import { roleHasPermission } from "@/lib/permissions";
import type { RoleName } from "@prisma/client";

const SEVERITY_STYLES: Record<string, string> = {
  LOW: "bg-green-50 text-green-700 border-green-200",
  MEDIUM: "bg-yellow-50 text-yellow-700 border-yellow-200",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200",
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
};

type Observation = {
  id: string;
  observationCode: string;
  category: string;
  subcategory: string | null;
  description: string;
  severity: string;
  status: ObservationStatus;
  location: string;
  locationDetail: string | null;
  versionNumber: string;
  createdByName: string;
  createdById: string;
  createdAt: string;
  assignedTo: { id: string; name: string } | null;
  dueDate: string | null;
  resolution: string | null;
  resolvedByName: string | null;
  resolvedDate: string | null;
  approvedByName: string | null;
  approvedDate: string | null;
  comments: { id: string; body: string; createdAt: string; createdByName: string }[];
  correctiveActions: {
    id: string;
    description: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    assignedToName: string | null;
  }[];
  mediaCount: number;
};

export function ObservationDetailClient({
  observation,
  currentUserId,
  currentUserRole,
  assignableUsers,
}: {
  observation: Observation;
  currentUserId: string;
  currentUserRole: RoleName;
  assignableUsers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [newActionDescription, setNewActionDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState(observation.assignedTo?.id ?? "");

  const availableTransitions = ALLOWED_TRANSITIONS[observation.status] ?? [];
  const canApprove = roleHasPermission(currentUserRole, "observation.approve");
  const canAssign = roleHasPermission(currentUserRole, "observation.assign");
  const canActRoutine =
    roleHasPermission(currentUserRole, "observation.create") ||
    canAssign ||
    observation.assignedTo?.id === currentUserId ||
    observation.createdById === currentUserId; // best-effort; server is the real gate

  async function handleTransition(status: ObservationStatus) {
    setBusy(true);
    setError(null);
    try {
      let resolution: string | undefined;
      if (status === "FIXED") {
        resolution = window.prompt("Describe the fix / resolution:") ?? undefined;
      }
      const res = await fetch(`/api/v1/observations/${observation.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update status");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleAssign() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/observations/${observation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: assigneeId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to assign");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/observations/${observation.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody }),
      });
      if (res.ok) {
        setCommentBody("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAddCorrectiveAction(e: React.FormEvent) {
    e.preventDefault();
    if (!newActionDescription.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/observations/${observation.id}/corrective-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: newActionDescription }),
      });
      if (res.ok) {
        setNewActionDescription("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCompleteAction(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/v1/corrective-actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "FIXED" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3 mt-2 mb-1">
        <h1 className="text-lg font-semibold text-neutral-900">{observation.observationCode}</h1>
        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${SEVERITY_STYLES[observation.severity]}`}>
          {observation.severity}
        </span>
      </div>
      <p className="text-sm text-neutral-500 mb-4">
        {observation.category}
        {observation.subcategory ? ` — ${observation.subcategory}` : ""} · {observation.versionNumber} ·{" "}
        {observation.location.charAt(0) + observation.location.slice(1).toLowerCase()}
        {observation.locationDetail ? ` (${observation.locationDetail})` : ""}
      </p>

      <p className="text-sm text-neutral-800 bg-white border border-neutral-200 rounded-lg px-4 py-3 mb-4">
        {observation.description}
      </p>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-medium px-2 py-1 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
          {observation.status.replace(/_/g, " ")}
        </span>
        <span className="text-xs text-neutral-400">
          Reported by {observation.createdByName} on {new Date(observation.createdAt).toLocaleDateString()}
        </span>
      </div>

      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}

      {availableTransitions.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-neutral-600 mb-1.5">Move to:</p>
          <div className="flex flex-wrap gap-2">
            {availableTransitions.map((status) => {
              const needsApproval = requiresApprovalPermission(status);
              const disabled = busy || (needsApproval && !canApprove) || (!needsApproval && !canActRoutine);
              return (
                <button
                  key={status}
                  disabled={disabled}
                  onClick={() => handleTransition(status)}
                  title={disabled ? "You don't have permission for this transition" : undefined}
                  className="text-xs font-medium px-3 py-1.5 rounded border border-neutral-300 text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-neutral-100"
                >
                  {status.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {observation.resolution && (
        <div className="mb-4 text-sm bg-blue-50 border border-blue-200 text-blue-900 rounded-lg px-4 py-3">
          <p className="font-medium">Resolution</p>
          <p>{observation.resolution}</p>
          {observation.resolvedByName && (
            <p className="text-xs text-blue-700 mt-1">
              by {observation.resolvedByName}
              {observation.resolvedDate ? ` on ${new Date(observation.resolvedDate).toLocaleDateString()}` : ""}
            </p>
          )}
        </div>
      )}

      {observation.approvedByName && (
        <p className="text-xs text-neutral-400 mb-4">
          {observation.status === "REJECTED" ? "Rejected" : "Approved"} by {observation.approvedByName}
          {observation.approvedDate ? ` on ${new Date(observation.approvedDate).toLocaleDateString()}` : ""}
        </p>
      )}

      {canAssign && (
        <div className="mb-6 bg-white border border-neutral-200 rounded-lg p-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Assigned to</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
            >
              <option value="">Unassigned</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAssign}
            disabled={busy}
            className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-2">Corrective Actions</h2>
        {observation.correctiveActions.length === 0 && (
          <p className="text-sm text-neutral-400 mb-2">None recorded.</p>
        )}
        <div className="space-y-2 mb-2">
          {observation.correctiveActions.map((ca) => (
            <div key={ca.id} className="bg-white border border-neutral-200 rounded-lg px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-800">{ca.description}</p>
                <p className="text-xs text-neutral-400">
                  {ca.assignedToName ? `Assigned to ${ca.assignedToName}` : "Unassigned"} ·{" "}
                  {ca.status === "FIXED" ? "Completed" : "Open"}
                </p>
              </div>
              {ca.status !== "FIXED" && canAssign && (
                <button
                  onClick={() => handleCompleteAction(ca.id)}
                  disabled={busy}
                  className="text-xs font-medium px-2.5 py-1 rounded border border-neutral-300"
                >
                  Mark complete
                </button>
              )}
            </div>
          ))}
        </div>
        {canAssign && (
          <form onSubmit={handleAddCorrectiveAction} className="flex gap-2">
            <input
              value={newActionDescription}
              onChange={(e) => setNewActionDescription(e.target.value)}
              placeholder="Describe the corrective action…"
              className="flex-1 rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
            />
            <button disabled={busy} className="text-xs font-medium px-3 py-1.5 rounded border border-neutral-300">
              Add
            </button>
          </form>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-neutral-900 mb-2">Comments</h2>
        <div className="space-y-2 mb-3">
          {observation.comments.map((c) => (
            <div key={c.id} className="bg-white border border-neutral-200 rounded-lg px-4 py-2.5">
              <p className="text-sm text-neutral-800">{c.body}</p>
              <p className="text-xs text-neutral-400 mt-1">
                {c.createdByName} · {new Date(c.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
          {observation.comments.length === 0 && <p className="text-sm text-neutral-400">No comments yet.</p>}
        </div>
        <form onSubmit={handleAddComment} className="flex gap-2">
          <input
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
          />
          <button disabled={busy} className="text-xs font-medium px-3 py-1.5 rounded border border-neutral-300">
            Post
          </button>
        </form>
      </div>
    </div>
  );
}
