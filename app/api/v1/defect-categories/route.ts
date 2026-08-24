import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, requireSession, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    await requireSession();
    const categories = await prisma.defectCategory.findMany({
      where: { active: true },
      select: { id: true, name: true, subcategories: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ categories });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  subcategories: z.array(z.string().min(1).max(100)).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Section 13: "Allow administrators to add or modify categories later."
    const { userId } = await requirePermission("admin.categories.manage");

    const body = await req.json();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const category = await tx.defectCategory.create({
        data: { name: parsed.data.name, subcategories: parsed.data.subcategories ?? [] },
      });
      await writeAuditLog(tx, {
        userId,
        action: "CREATE_DEFECT_CATEGORY",
        objectType: "DefectCategory",
        objectId: category.id,
        newValue: parsed.data,
      });
      return category;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
