import { PrismaClient } from "@prisma/client";

// Standard Next.js pattern: reuse the Prisma client across hot reloads in dev
// so we don't exhaust the Postgres connection pool.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
