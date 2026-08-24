import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, UnauthorizedError } from "@/lib/authorize";
import { createCommentSchema } from "@/lib/validation/observation";

export async function POST(req: NextRequest, { params }: { params: { obsId: string } }) {
  try {
    // Commenting is intentionally low-friction — anyone who can already see
    // the observation (i.e. is signed in and reached this page) can add
    // context. Structured decisions (status, approval) go through their own
    // permission-checked endpoints; this is just collaboration.
    const session = await requireSession();

    const observation = await prisma.observation.findUnique({ where: { id: params.obsId } });
    if (!observation) return NextResponse.json({ error: "Observation not found" }, { status: 404 });

    const body = await req.json();
    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        entityType: "Observation",
        entityId: observation.id,
        observationId: observation.id,
        body: parsed.data.body,
        createdById: session.user.id,
      },
      include: { createdBy: { select: { name: true } } },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
