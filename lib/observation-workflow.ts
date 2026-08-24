export type ObservationStatus =
  | "NEW"
  | "CORRECTIVE_ACTION_REQUIRED"
  | "IN_PROGRESS"
  | "PENDING"
  | "FIXED"
  | "APPROVED"
  | "REJECTED"
  | "CLOSED";

/**
 * Allowed forward/lateral transitions per status. Anything not listed here
 * is rejected by the API regardless of who's asking (Section 16: "Do not
 * allow inappropriate status transitions unless the user's role permits
 * it" — role is checked separately in the route for the subset of
 * transitions that need elevated permission, see requiresApprovalPermission).
 */
export const ALLOWED_TRANSITIONS: Record<ObservationStatus, ObservationStatus[]> = {
  NEW: ["CORRECTIVE_ACTION_REQUIRED", "IN_PROGRESS", "CLOSED"],
  CORRECTIVE_ACTION_REQUIRED: ["IN_PROGRESS", "PENDING"],
  IN_PROGRESS: ["FIXED", "PENDING", "CORRECTIVE_ACTION_REQUIRED"],
  PENDING: ["IN_PROGRESS", "CORRECTIVE_ACTION_REQUIRED"],
  FIXED: ["APPROVED", "REJECTED"],
  APPROVED: ["CLOSED"],
  REJECTED: ["IN_PROGRESS"],
  CLOSED: [],
};

export function isValidTransition(from: ObservationStatus, to: ObservationStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Approving or rejecting a fix is a QC decision, not a routine status update. */
export function requiresApprovalPermission(to: ObservationStatus): boolean {
  return to === "APPROVED" || to === "REJECTED";
}
