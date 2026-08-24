import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { updateUserSchema } from "@/lib/validation/user";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await requirePermission("admin.users.manage");

    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: params.id },
      include: { role: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { name, role, active } = parsed.data;
    const roleRecord = role ? await prisma.role.findUnique({ where: { name: role } }) : null;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: params.id },
        data: {
          name: name ?? undefined,
          active: active ?? undefined,
          roleId: roleRecord?.id ?? undefined,
        },
        include: { role: true },
      });

      await writeAuditLog(tx, {
        userId,
        action: "UPDATE_USER",
        objectType: "User",
        objectId: result.id,
        previousValue: { name: existing.name, active: existing.active, role: existing.role.name },
        newValue: { name: result.name, active: result.active, role: result.role.name },
      });

      return result;
    });

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      active: updated.active,
      role: updated.role.name,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
