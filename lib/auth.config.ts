import type { NextAuthConfig } from "next-auth";
import type { RoleName } from "@prisma/client";

// This file must NEVER import lib/db.ts (Prisma) or anything that pulls it
// in transitively. It's used directly by middleware.ts, which Next.js runs
// in the Edge Runtime — a restricted environment that Prisma's client
// cannot run in at all. Splitting the config this way (recommended by
// Auth.js for exactly this Prisma + Middleware combination) keeps the
// database client out of the Edge bundle entirely.
//
// The actual Credentials provider (which needs Prisma to look up users)
// lives in lib/auth.ts instead, and is only used by API routes and server
// components, which run in the normal Node.js runtime.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: RoleName;
    };
  }
}

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [], // populated in lib/auth.ts, not here
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: RoleName }).role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id as string;
      session.user.role = token.role as RoleName;
      return session;
    },
  },
};
