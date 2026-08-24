import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { createProductSchema } from "@/lib/validation/product";
import { generateProductId } from "@/lib/product-id";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("product.view");

    const projectId = req.nextUrl.searchParams.get("projectId") ?? undefined;

    const products = await prisma.product.findMany({
      where: projectId ? { projectId } : undefined,
      select: {
        id: true,
        productId: true,
        productNumber: true,
        name: true,
        category: true,
        status: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
        designer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ products });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requirePermission("product.create");

    const body = await req.json();
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { projectId, designerId, tags, ...rest } = parsed.data;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });

    if (designerId) {
      const designer = await prisma.user.findUnique({ where: { id: designerId } });
      if (!designer) return NextResponse.json({ error: "Designer not found" }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const productId = await generateProductId(tx, rest.category);

      const product = await tx.product.create({
        data: {
          ...rest,
          productId,
          projectId,
          designerId,
          createdById: userId,
          status: "FIRST_PROTOTYPE",
          tags: tags?.length
            ? {
                create: tags.map((name) => ({
                  tag: {
                    connectOrCreate: { where: { name }, create: { name } },
                  },
                })),
              }
            : undefined,
        },
      });

      await writeAuditLog(tx, {
        userId,
        action: "CREATE_PRODUCT",
        objectType: "Product",
        objectId: product.id,
        newValue: { productId: product.productId, name: product.name, category: product.category },
      });

      return product;
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
