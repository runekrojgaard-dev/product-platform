import { z } from "zod";
import { RoleName } from "@prisma/client";

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(RoleName),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.nativeEnum(RoleName).optional(),
  active: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
