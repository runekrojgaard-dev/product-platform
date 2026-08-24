import type { Prisma, PrismaClient } from "@prisma/client";

export async function generateObservationCode(
  tx: Prisma.TransactionClient | PrismaClient
): Promise<string> {
  const count = await tx.observation.count();
  return `OBS-${(count + 1).toString().padStart(5, "0")}`;
}
