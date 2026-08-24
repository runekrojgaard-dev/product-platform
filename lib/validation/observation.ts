import { z } from "zod";

export const severityValues = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const observationStatusValues = [
  "NEW",
  "CORRECTIVE_ACTION_REQUIRED",
  "IN_PROGRESS",
  "PENDING",
  "FIXED",
  "APPROVED",
  "REJECTED",
  "CLOSED",
] as const;

export const productLocationValues = [
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

export const createObservationSchema = z.object({
  productVersionId: z.string().uuid(),
  productionBatchId: z.string().uuid().optional(),
  category: z.string().min(1).max(100),
  subcategory: z.string().max(100).optional(),
  description: z.string().min(1).max(2000),
  severity: z.enum(severityValues),
  location: z.enum(productLocationValues),
  locationDetail: z.string().max(500).optional(),
  assignedToId: z.string().uuid().optional(),
  dueDate: z.coerce.date().optional(),
});
export type CreateObservationInput = z.infer<typeof createObservationSchema>;

export const updateObservationSchema = z.object({
  assignedToId: z.string().uuid().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});
export type UpdateObservationInput = z.infer<typeof updateObservationSchema>;

export const transitionStatusSchema = z.object({
  status: z.enum(observationStatusValues),
  resolution: z.string().max(2000).optional(),
  comment: z.string().max(2000).optional(),
});
export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;

export const createCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const createCorrectiveActionSchema = z.object({
  description: z.string().min(1).max(2000),
  assignedToId: z.string().uuid().optional(),
});
export type CreateCorrectiveActionInput = z.infer<typeof createCorrectiveActionSchema>;

export const updateCorrectiveActionSchema = z.object({
  status: z.enum(observationStatusValues).optional(),
  completedAt: z.coerce.date().optional(),
});
export type UpdateCorrectiveActionInput = z.infer<typeof updateCorrectiveActionSchema>;
