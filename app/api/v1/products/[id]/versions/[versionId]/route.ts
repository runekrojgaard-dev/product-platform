import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string; versionId: string }> }
) {
  const params = await paramsPromise;
  try {
    await requirePermission("product.view");

    const version = await prisma.productVersion.findFirst({
      where: { id: params.versionId, productId: params.id },
      include: {
        createdBy: { select: { name: true } },
        masterSample: true,
      },
    });

    if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

    return NextResponse.json(version);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
