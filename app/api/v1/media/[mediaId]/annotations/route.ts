import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { createAnnotationsSchema } from "@/lib/validation/annotation";

export async function GET(_req: NextRequest, { params }: { params: { mediaId: string } }) {
  try {
    await requirePermission("product.view");

    const annotations = await prisma.annotation.findMany({
      where: { mediaId: params.mediaId },
      select: { id: true, type: true, geometry: true, textLabel: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ annotations });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { mediaId: string } }) {
  try {
    // This is called against the NEW annotated-copy Media row (created via
    // the normal upload endpoint with parentMediaId set to the original) —
    // the annotation shapes describe that copy, while the original image
    // underneath remains untouched and fully preserved (Section 11).
    const { userId } = await requirePermission("media.upload");

    const media = await prisma.media.findUnique({ where: { id: params.mediaId } });
    if (!media) return NextResponse.json({ error: "Media not found" }, { status: 404 });

    const body = await req.json();
    const parsed = createAnnotationsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const rows = await Promise.all(
        parsed.data.annotations.map((a) =>
          tx.annotation.create({
            data: {
              mediaId: media.id,
              type: a.type,
              geometry: a.geometry,
              textLabel: a.textLabel,
              createdById: userId,
            },
          })
        )
      );

      await writeAuditLog(tx, {
        userId,
        action: "ANNOTATE_MEDIA",
        objectType: "Media",
        objectId: media.id,
        newValue: { annotationCount: rows.length },
      });

      return rows;
    });

    return NextResponse.json({ annotations: created }, { status: 201 });
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
