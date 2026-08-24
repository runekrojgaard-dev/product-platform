import { z } from "zod";

export const annotationTypeValues = ["CIRCLE", "ARROW", "LINE", "FREEHAND", "TEXT"] as const;

// Geometry is stored in fractional coordinates (0-1 relative to image width/
// height) so annotations still line up correctly regardless of what size
// the image is later displayed or exported at.
export const annotationSchema = z.object({
  type: z.enum(annotationTypeValues),
  geometry: z.record(z.string(), z.unknown()),
  textLabel: z.string().max(200).optional(),
});

export const createAnnotationsSchema = z.object({
  annotations: z.array(annotationSchema).min(1),
});
export type CreateAnnotationsInput = z.infer<typeof createAnnotationsSchema>;
