import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { decideMasterSampleSchema } from "@/lib/validation/master-sample";

export async function POST(req: NextRequest, { params }: { params: { msId: string } }) {
  try {
    const { userId } = await requirePermission("product.mastersample.approve");

    const body = await req.json().catch(() => ({}));
    const parsed = decideMasterSampleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const masterSample = await prisma.masterSample.findUnique({ where: { id: params.msId } });
    if (!masterSample) return NextResponse.json({ error: "Master Sample not found" }, { status: 404 });
    if (masterSample.approvalStatus !== "PENDING") {
      return NextResponse.json({ error: "Only a pending Master Sample can be rejected" }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.masterSample.update({
        where: { id: params.msId },
        data: {
          approvalStatus: "REJECTED",
          approvedById: userId,
          approvedDate: new Date(),
          approvalComments: parsed.data.comments,
        },
      });

      await writeAuditLog(tx, {
        userId,
        action: "REJECT_MASTER_SAMPLE",
        objectType: "MasterSample",
        objectId: result.id,
        previousValue: { approvalStatus: "PENDING" },
        newValue: { approvalStatus: "REJECTED", comments: parsed.data.comments },
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
