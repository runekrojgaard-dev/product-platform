import { z } from "zod";

export const batchStatusValues = ["PLANNED", "IN_PRODUCTION", "COMPLETED", "ON_HOLD"] as const;

export const createProductionBatchSchema = z.object({
  masterSampleId: z.string().uuid(),
  productionDate: z.coerce.date(),
  productionLocation: z.string().max(200).optional(),
  supplier: z.string().max(200).optional(),
  quantity: z.number().int().positive(),
  productionManagerId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateProductionBatchInput = z.infer<typeof createProductionBatchSchema>;

export const updateProductionBatchSchema = z.object({
  status: z.enum(batchStatusValues).optional(),
  notes: z.string().max(2000).optional(),
  quantity: z.number().int().positive().optional(),
});
export type UpdateProductionBatchInput = z.infer<typeof updateProductionBatchSchema>;
