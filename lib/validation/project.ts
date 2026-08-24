import { z } from "zod";

export const projectStatusValues = ["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  customerId: z.string().uuid(),
  status: z.enum(projectStatusValues).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(projectStatusValues).optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
