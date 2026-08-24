import { z } from "zod";

export const measurementUnitValues = ["mm", "cm", "m", "kg", "degrees"] as const;

export const createMeasurementSchema = z
  .object({
    name: z.string().min(1).max(100),
    unit: z.enum(measurementUnitValues),
    referenceValue: z.number(),
    toleranceLower: z.number().nonnegative(),
    toleranceUpper: z.number().nonnegative(),
    measuredValue: z.number(),
    notes: z.string().max(1000).optional(),
    productVersionId: z.string().uuid().optional(),
    masterSampleId: z.string().uuid().optional(),
    productionBatchId: z.string().uuid().optional(),
    observationId: z.string().uuid().optional(),
    photoMediaId: z.string().uuid().optional(),
  })
  // Every measurement must be traceable to something (Rule 6: "Measurements
  // must be structured... not only written in comments" implies they must
  // hang off a real record, not float unattached).
  .refine(
    (v) => v.productVersionId || v.masterSampleId || v.productionBatchId || v.observationId,
    { message: "A measurement must be linked to a version, Master Sample, production batch, or observation" }
  );

export type CreateMeasurementInput = z.infer<typeof createMeasurementSchema>;
