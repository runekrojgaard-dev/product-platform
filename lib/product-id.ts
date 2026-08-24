import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Generates the permanent, human-readable Product ID (e.g. CHR-00482).
 *
 * ASSUMPTION (flagged — confirm or override): prefix = first 3 letters of the
 * product category, uppercased (e.g. "Chair" -> "CHR"), falling back to "PRD"
 * if the category yields no letters. The number is a 5-digit, zero-padded
 * sequence scoped to that prefix, based on how many products already use it.
 * If your organization has an existing numbering convention (e.g. per-year,
 * per-customer, or a fixed category-code table), tell me and I'll swap this
 * out — it's isolated to this one function.
 *
 * Runs inside the same transaction as product creation to avoid a race
 * between the count and the insert.
 */
export async function generateProductId(
  tx: Prisma.TransactionClient | PrismaClient,
  category: string
): Promise<string> {
  const letters = category.replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = (letters.slice(0, 3) || "PRD").padEnd(3, "X");

  const count = await tx.product.count({
    where: { productId: { startsWith: `${prefix}-` } },
  });

  const nextNumber = (count + 1).toString().padStart(5, "0");
  return `${prefix}-${nextNumber}`;
}
