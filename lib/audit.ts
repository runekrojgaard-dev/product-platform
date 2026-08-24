import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Every create/update/status-change across the app should call this in the
 * SAME transaction as the write, so the audit trail can never drift from
 * reality (architecture doc, Section 25 / Rule 2).
 */
export async function writeAuditLog(
  tx: Prisma.TransactionClient | typeof prisma,
  entry: {
    userId: string;
    action: string;
    objectType: string;
    objectId: string;
    previousValue?: unknown;
    newValue?: unknown;
  }
) {
  await tx.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      objectType: entry.objectType,
      objectId: entry.objectId,
      previousValue: entry.previousValue as Prisma.InputJsonValue,
      newValue: entry.newValue as Prisma.InputJsonValue,
    },
  });
}
