import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { proposeMasterSampleSchema } from "@/lib/validation/master-sample";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission("product.view");

    const masterSamples = await prisma.masterSample.findMany({
      where: { productId: params.id },
      select: {
        id: true,
        masterVersionNumber: true,
        approvalStatus: true,
        approvedDate: true,
        approvalComments: true,
        isCurrent: true,
        createdAt: true,
        approvedBy: { select: { name: true } },
        productVersion: { select: { id: true, versionNumber: true, versionType: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ masterSamples });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Proposing is intentionally separate from approving (Section 8:
    // "propose Master Samples" is a Product Designer action; approval is a
    // distinct, recorded decision). This endpoint never marks a sample
    // approved or current on its own.
    const { userId } = await requirePermission("product.mastersample.propose");

    const body = await req.json();
    const parsed = proposeMasterSampleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const version = await prisma.productVersion.findFirst({
      where: { id: parsed.data.productVersionId, productId: params.id },
    });
    if (!version) {
      return NextResponse.json({ error: "Version not found on this product" }, { status: 404 });
    }

    const existingForVersion = await prisma.masterSample.findUnique({
      where: { productVersionId: version.id },
    });
    if (existingForVersion) {
      return NextResponse.json(
        { error: "This version has already been proposed as a Master Sample" },
        { status: 409 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const count = await tx.masterSample.count({ where: { productId: params.id } });
      const masterVersionNumber = `Master V${count + 1}`;

      const masterSample = await tx.masterSample.create({
        data: {
          productId: params.id,
          productVersionId: version.id,
          masterVersionNumber,
          approvalStatus: "PENDING",
        },
      });

      await writeAuditLog(tx, {
        userId,
        action: "PROPOSE_MASTER_SAMPLE",
        objectType: "MasterSample",
        objectId: masterSample.id,
        newValue: { productId: params.id, productVersionId: version.id, masterVersionNumber },
      });

      return masterSample;
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
