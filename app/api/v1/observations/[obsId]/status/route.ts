import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { roleHasPermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { transitionStatusSchema } from "@/lib/validation/observation";
import { isValidTransition, requiresApprovalPermission, type ObservationStatus } from "@/lib/observation-workflow";

export async function POST(req: NextRequest, { params }: { params: { obsId: string } }) {
  try {
    // Baseline: must at least be able to view observations to touch one.
    // Finer-grained role checks happen below based on the specific
    // transition requested (Section 16: role-gated transitions).
    const { userId } = await requirePermission("observation.view");
    const session = await auth();
    const role = session!.user.role;

    const body = await req.json();
    const parsed = transitionStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const observation = await prisma.observation.findUnique({ where: { id: params.obsId } });
    if (!observation) return NextResponse.json({ error: "Observation not found" }, { status: 404 });

    const from = observation.status as ObservationStatus;
    const to = parsed.data.status;

    if (!isValidTransition(from, to)) {
      return NextResponse.json(
        { error: `Cannot move an observation from ${from} to ${to}` },
        { status: 409 }
      );
    }

    if (requiresApprovalPermission(to) && !roleHasPermission(role, "observation.approve")) {
      return NextResponse.json(
        { error: "Only Quality Control or an Administrator can approve or reject a fix" },
        { status: 403 }
      );
    }

    // Anyone who can create/assign observations may move it through the
    // routine part of the workflow; otherwise only the assignee or the
    // original reporter can update it.
    const canRoutine =
      roleHasPermission(role, "observation.create") ||
      roleHasPermission(role, "observation.assign") ||
      observation.assignedToId === userId ||
      observation.createdById === userId;
    if (!requiresApprovalPermission(to) && !canRoutine) {
      return NextResponse.json(
        { error: "You are not assigned to this observation" },
        { status: 403 }
      );
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.observation.update({
        where: { id: params.obsId },
        data: {
          status: to,
          resolution: to === "FIXED" ? parsed.data.resolution ?? observation.resolution : observation.resolution,
          resolvedById: to === "FIXED" ? userId : observation.resolvedById,
          resolvedDate: to === "FIXED" ? now : observation.resolvedDate,
          approvedById: requiresApprovalPermission(to) ? userId : observation.approvedById,
          approvedDate: requiresApprovalPermission(to) ? now : observation.approvedDate,
        },
      });

      if (parsed.data.comment) {
        await tx.comment.create({
          data: {
            entityType: "Observation",
            entityId: observation.id,
            observationId: observation.id,
            body: parsed.data.comment,
            createdById: userId,
          },
        });
      }

      await writeAuditLog(tx, {
        userId,
        action: "CHANGE_OBSERVATION_STATUS",
        objectType: "Observation",
        objectId: result.id,
        previousValue: { status: from },
        newValue: { status: to, resolution: parsed.data.resolution },
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
