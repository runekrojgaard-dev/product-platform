import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";

/**
 * MVP search: case-insensitive `contains` across the fields named in
 * Section 23 (Product ID/Number/Name, Project, Customer, Batch,
 * Observation ID, Defect Category, Material, Supplier, User). This is
 * fine at MVP data volumes. As the brief itself anticipates (Section 26
 * database design + general scaling guidance), a real deployment should
 * move this to Postgres full-text search (tsvector + pg_trgm for fuzzy
 * matching) once product/observation counts grow — swapping the query
 * inside this one function, not the API contract.
 */
export async function GET(req: NextRequest) {
  try {
    await requirePermission("product.view");

    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ products: [], projects: [], batches: [], observations: [] });
    }

    const contains = { contains: q, mode: "insensitive" as const };

    const [products, projects, batches, observations] = await Promise.all([
      prisma.product.findMany({
        where: {
          OR: [
            { productId: contains },
            { productNumber: contains },
            { name: contains },
            { category: contains },
          ],
        },
        select: { id: true, productId: true, name: true, category: true },
        take: 15,
      }),
      prisma.project.findMany({
        where: {
          OR: [{ name: contains }, { customer: { name: contains } }],
        },
        select: { id: true, name: true, customer: { select: { name: true } } },
        take: 10,
      }),
      prisma.productionBatch.findMany({
        where: {
          OR: [{ batchCode: contains }, { supplier: contains }],
        },
        select: { id: true, batchCode: true, supplier: true, product: { select: { id: true, name: true } } },
        take: 10,
      }),
      prisma.observation.findMany({
        where: {
          OR: [{ observationCode: contains }, { category: contains }, { description: contains }],
        },
        select: {
          id: true,
          observationCode: true,
          category: true,
          status: true,
          product: { select: { id: true, name: true } },
        },
        take: 10,
      }),
    ]);

    return NextResponse.json({ products, projects, batches, observations });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
