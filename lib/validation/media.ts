import { z } from "zod";

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

export const uploadMediaMetadataSchema = z.object({
  productVersionId: z.string().uuid().optional(),
  productionBatchId: z.string().uuid().optional(),
  observationId: z.string().uuid().optional(),
  imageType: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  locationArea: z.enum(productLocationValues).optional(),
  isMasterReference: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  parentMediaId: z.string().uuid().optional(),
});
export type UploadMediaMetadataInput = z.infer<typeof uploadMediaMetadataSchema>;

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB — generous for phone camera photos
