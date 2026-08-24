import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { createProductVersionSchema } from "@/lib/validation/product-version";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission("product.view");

    const versions = await prisma.productVersion.findMany({
      where: { productId: params.id },
      select: {
        id: true,
        versionNumber: true,
        versionType: true,
        description: true,
        changeSummary: true,
        createdAt: true,
        createdBy: { select: { name: true } },
        masterSample: { select: { id: true, masterVersionNumber: true, isCurrent: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ versions });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // IMPORTANT: this endpoint only ever INSERTS a new ProductVersion row.
    // There is deliberately no PATCH/PUT endpoint for an existing version —
    // approved historical data must never be overwritten (Rule 1). Anyone
    // who needs to "change" a version creates a new one instead.
    const { userId } = await requirePermission("product.version.create");

    const product = await prisma.product.findUnique({ where: { id: params.id } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const body = await req.json();
    const parsed = createProductVersionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.productVersion.count({ where: { productId: params.id } });
      const versionNumber = `V${existingCount + 1}`;

      const version = await tx.productVersion.create({
        data: {
          productId: params.id,
          versionNumber,
          versionType: parsed.data.versionType,
          description: parsed.data.description,
          changeSummary: parsed.data.changeSummary,
          dimensions: parsed.data.dimensions,
          materials: parsed.data.materials,
          finishes: parsed.data.finishes,
          components: parsed.data.components,
          specifications: parsed.data.specifications,
          createdById: userId,
        },
      });

      // The newest version becomes the product's "current" pointer and its
      // type advances the product's overall lifecycle status — matching the
      // "Current Version" field described in the architecture (Section 5).
      await tx.product.update({
        where: { id: params.id },
        data: {
          currentVersionId: version.id,
          status: parsed.data.versionType,
        },
      });

      await writeAuditLog(tx, {
        userId,
        action: "CREATE_PRODUCT_VERSION",
        objectType: "ProductVersion",
        objectId: version.id,
        newValue: {
          productId: params.id,
          versionNumber,
          versionType: parsed.data.versionType,
          changeSummary: parsed.data.changeSummary,
        },
      });

      return version;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
