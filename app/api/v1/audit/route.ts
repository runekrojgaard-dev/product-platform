import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";

// GET /api/v1/audit?objectType=&objectId=&userId=&page=1
export async function GET(req: NextRequest) {
  try {
    await requirePermission("audit.view");

    const objectType = req.nextUrl.searchParams.get("objectType") ?? undefined;
    const objectId = req.nextUrl.searchParams.get("objectId") ?? undefined;
    const userId = req.nextUrl.searchParams.get("userId") ?? undefined;
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1"));
    const pageSize = 50;

    const where = { objectType, objectId, userId };

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          objectType: true,
          objectId: true,
          previousValue: true,
          newValue: true,
          createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ entries, total, page, pageSize });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
