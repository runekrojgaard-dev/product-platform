import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { updateProductSchema } from "@/lib/validation/product";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission("product.view");

    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { id: true, name: true, customer: { select: { name: true } } } },
        designer: { select: { id: true, name: true } },
        tags: { select: { tag: { select: { name: true } } } },
      },
    });

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    return NextResponse.json({
      ...product,
      tags: product.tags.map((t) => t.tag.name),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Note: this updates mutable Product metadata (name, number, category,
    // designer, status, tags) only. Approved specification data
    // (dimensions/materials/etc.) lives on ProductVersion and is never
    // edited in place — see Stage 4 (Product Versions).
    const { userId } = await requirePermission("product.create");

    const body = await req.json();
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.product.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const { tags, ...rest } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      if (tags) {
        await tx.productTag.deleteMany({ where: { productId: params.id } });
      }

      const result = await tx.product.update({
        where: { id: params.id },
        data: {
          ...rest,
          tags: tags?.length
            ? {
                create: tags.map((name) => ({
                  tag: { connectOrCreate: { where: { name }, create: { name } } },
                })),
              }
            : undefined,
        },
      });

      await writeAuditLog(tx, {
        userId,
        action: "UPDATE_PRODUCT",
        objectType: "Product",
        objectId: result.id,
        previousValue: {
          name: existing.name,
          category: existing.category,
          status: existing.status,
          designerId: existing.designerId,
        },
        newValue: parsed.data,
      });

      return result;
    });

    return NextResponse.json(updated);
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
