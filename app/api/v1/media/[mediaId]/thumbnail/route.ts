import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { getStorageDriver } from "@/lib/storage";

export async function GET(_req: NextRequest, { params: paramsPromise }: { params: Promise<{ mediaId: string }> }) {
  const params = await paramsPromise;
  try {
    await requirePermission("product.view");

    const media = await prisma.media.findUnique({ where: { id: params.mediaId } });
    if (!media) return NextResponse.json({ error: "Media not found" }, { status: 404 });

    const storage = await getStorageDriver();
    const key = media.thumbnailKey ?? media.storageKey;
    const object = await storage.getObject(key);
    if (!object) return NextResponse.json({ error: "Thumbnail not found in storage" }, { status: 404 });

    return new NextResponse(new Uint8Array(object.data), {
      headers: {
        "Content-Type": object.contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
