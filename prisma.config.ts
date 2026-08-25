import { defineConfig } from "prisma/config";

// Prisma 7 removed support for `url = env("DATABASE_URL")` directly inside
// schema.prisma. The CLI (generate/migrate) now reads the connection string
// from here instead. The running application's PrismaClient gets its
// connection separately, via the driver adapter in lib/db.ts — see that
// file for why.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
