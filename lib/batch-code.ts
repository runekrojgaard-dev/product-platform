import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Generates the production batch code (e.g. 2026-08-003), matching the
 * example in the brief (Section 19). Sequence is scoped to year+month across
 * the whole organization, not per-product — matching the example format,
 * which has no product reference in it. Flagged assumption: confirm this is
 * the intended scope, or tell me if it should be per-product/per-customer.
 */
export async function generateBatchCode(
  tx: Prisma.TransactionClient | PrismaClient,
  date: Date
): Promise<string> {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const prefix = `${year}-${month}-`;

  const count = await tx.productionBatch.count({
    where: { batchCode: { startsWith: prefix } },
  });

  const sequence = (count + 1).toString().padStart(3, "0");
  return `${prefix}${sequence}`;
}
