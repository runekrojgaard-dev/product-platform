import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { RoleName } from "@prisma/client";

// Auth.js is configured with the Credentials provider for MVP (email + password).
// SSO (e.g. Microsoft Entra ID) can be added later as an additional provider
// without any schema or session-shape changes — see architecture doc Section E.

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { role: true },
        });

        if (!user || !user.active) return null;

        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.name,
        };
      },
    }),
  ],
  callbacks: {
    // Persist role onto the JWT at sign-in so we don't hit the DB on every request.
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
});
