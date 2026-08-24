import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { compareVersions } from "@/lib/version-diff";

// GET /api/v1/products/:id/versions/compare?a=<versionId>&b=<versionId>
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission("product.view");

    const aId = req.nextUrl.searchParams.get("a");
    const bId = req.nextUrl.searchParams.get("b");
    if (!aId || !bId) {
      return NextResponse.json({ error: "Query params 'a' and 'b' (version ids) are required" }, { status: 400 });
    }

    const [a, b] = await Promise.all([
      prisma.productVersion.findFirst({ where: { id: aId, productId: params.id } }),
      prisma.productVersion.findFirst({ where: { id: bId, productId: params.id } }),
    ]);

    if (!a || !b) {
      return NextResponse.json({ error: "One or both versions not found on this product" }, { status: 404 });
    }

    const diff = compareVersions(a, b);

    return NextResponse.json({
      a: { id: a.id, versionNumber: a.versionNumber, versionType: a.versionType },
      b: { id: b.id, versionNumber: b.versionNumber, versionType: b.versionType },
      diff,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
