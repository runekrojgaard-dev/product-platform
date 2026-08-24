import { z } from "zod";

export const productStatusValues = [
  "FIRST_PROTOTYPE",
  "PROTOTYPE",
  "DEVELOPMENT",
  "PRE_PRODUCTION",
  "MASTER_SAMPLE",
  "PRODUCTION",
  "QUALITY_CONTROL",
  "DELIVERY",
  "ASSEMBLY_INSTALLATION",
  "COMPLETED",
  "SERVICE_CLAIM",
] as const;

export const createProductSchema = z.object({
  productNumber: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  projectId: z.string().uuid(),
  designerId: z.string().uuid().optional(),
  tags: z.array(z.string().min(1).max(50)).optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  productNumber: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(100).optional(),
  designerId: z.string().uuid().nullable().optional(),
  status: z.enum(productStatusValues).optional(),
  tags: z.array(z.string().min(1).max(50)).optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
