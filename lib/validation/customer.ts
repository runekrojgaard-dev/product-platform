import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  contactInfo: z
    .object({
      contactName: z.string().max(200).optional(),
      email: z.string().email().optional(),
      phone: z.string().max(50).optional(),
      address: z.string().max(500).optional(),
    })
    .optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
