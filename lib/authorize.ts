import { auth } from "@/lib/auth";
import { roleHasPermission, type Permission } from "@/lib/permissions";
import type { RoleName } from "@prisma/client";

export class UnauthorizedError extends Error {
  status = 401;
}
export class ForbiddenError extends Error {
  status = 403;
}

/**
 * Every mutating (and most reading) server action / API route must call this
 * before touching the database. This is the ONLY place authorization is
 * decided — never trust a role check performed in client code
 * (architecture doc, Section 28).
 */
export async function requirePermission(permission: Permission): Promise<{
  userId: string;
  role: RoleName;
}> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError("Not signed in");
  }
  if (!roleHasPermission(session.user.role, permission)) {
    throw new ForbiddenError(
      `Role ${session.user.role} does not have permission ${permission}`
    );
  }
  return { userId: session.user.id, role: session.user.role };
}

/** Use when a route just needs "any authenticated user", no specific permission. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError("Not signed in");
  }
  return session;
}
