import { z } from "zod";

export const proposeMasterSampleSchema = z.object({
  productVersionId: z.string().uuid(),
});
export type ProposeMasterSampleInput = z.infer<typeof proposeMasterSampleSchema>;

export const decideMasterSampleSchema = z.object({
  comments: z.string().max(2000).optional(),
});
export type DecideMasterSampleInput = z.infer<typeof decideMasterSampleSchema>;
