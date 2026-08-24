import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";

// GET /api/v1/products/lookup?productId=CHR-00482
// Used by the mobile Scan flow: decode QR -> look up here -> open the
// product. Also usable as a manual-entry fallback per Section 29.
export async function GET(req: NextRequest) {
  try {
    await requirePermission("product.view");

    const productId = req.nextUrl.searchParams.get("productId")?.trim().toUpperCase();
    if (!productId) {
      return NextResponse.json({ error: "productId query param is required" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { productId },
      select: {
        id: true,
        productId: true,
        name: true,
        productNumber: true,
        status: true,
        currentVersion: { select: { versionNumber: true, versionType: true } },
        currentMasterSample: {
          select: { masterVersionNumber: true, approvalStatus: true, isCurrent: true },
        },
        _count: { select: { observations: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: `No product found with ID ${productId}` }, { status: 404 });
    }

    return NextResponse.json({
      id: product.id,
      productId: product.productId,
      name: product.name,
      productNumber: product.productNumber,
      status: product.status,
      currentVersion: product.currentVersion,
      currentMasterSample: product.currentMasterSample,
      // Open Quality Issues will be a real filtered count once Observations
      // (Stage 10) exist; total count shown for now so the field isn't
      // silently wrong.
      totalObservations: product._count.observations,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
