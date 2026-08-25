import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 no longer reads the connection string from schema.prisma at
// runtime — the PrismaClient must be given a driver adapter explicitly.
// (prisma.config.ts handles the separate case of the CLI itself needing a
// connection string, for `generate`/`migrate`.)
const adapter = new PrismaPg(process.env.DATABASE_URL as string);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
