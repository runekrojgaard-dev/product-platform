import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { createUserSchema } from "@/lib/validation/user";

export async function GET() {
  try {
    const { } = await requirePermission("admin.users.manage");

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        createdAt: true,
        role: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requirePermission("admin.users.manage");

    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { email, name, password, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    const roleRecord = await prisma.role.findUnique({ where: { name: role } });
    if (!roleRecord) {
      return NextResponse.json({ error: "Unknown role" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const created = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          name,
          passwordHash,
          roleId: roleRecord.id,
        },
      });

      await writeAuditLog(tx, {
        userId,
        action: "CREATE_USER",
        objectType: "User",
        objectId: newUser.id,
        newValue: { email: newUser.email, name: newUser.name, role },
      });

      return newUser;
    });

    return NextResponse.json(
      { id: created.id, email: created.email, name: created.name, role },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
