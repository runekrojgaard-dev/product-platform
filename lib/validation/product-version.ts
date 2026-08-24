import { z } from "zod";

// Structured sub-schemas for the JSONB fields on ProductVersion. Keeping
// these enforced at the application layer (not just "any JSON") is what
// makes the Compare Versions feature and future tolerance/report logic
// possible — see architecture doc, Section B note on ProductVersion.

export const dimensionEntrySchema = z.object({
  name: z.string().min(1).max(100), // e.g. "Seat Height"
  value: z.number(),
  unit: z.enum(["mm", "cm", "m", "kg", "degrees"]),
});

export const materialEntrySchema = z.object({
  component: z.string().min(1).max(100), // e.g. "Frame"
  material: z.string().min(1).max(200), // e.g. "Solid Oak"
});

export const finishEntrySchema = z.object({
  component: z.string().min(1).max(100),
  finish: z.string().min(1).max(200), // e.g. "Matte Lacquer"
  color: z.string().max(100).optional(),
});

export const componentEntrySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const specificationEntrySchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(500),
});

export const versionTypeValues = [
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

export const createProductVersionSchema = z.object({
  versionType: z.enum(versionTypeValues),
  description: z.string().max(2000).optional(),
  changeSummary: z.string().max(2000).optional(),
  dimensions: z.array(dimensionEntrySchema).default([]),
  materials: z.array(materialEntrySchema).default([]),
  finishes: z.array(finishEntrySchema).default([]),
  components: z.array(componentEntrySchema).default([]),
  specifications: z.array(specificationEntrySchema).default([]),
});

export type CreateProductVersionInput = z.infer<typeof createProductVersionSchema>;
