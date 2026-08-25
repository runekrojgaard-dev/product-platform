import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { getStorageDriver } from "@/lib/storage";
import { generateMediaKey, thumbnailKeyFor } from "@/lib/media-key";
import {
  uploadMediaMetadataSchema,
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from "@/lib/validation/media";

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    await requirePermission("product.view");

    const observationId = req.nextUrl.searchParams.get("observationId") ?? undefined;
    const productVersionId = req.nextUrl.searchParams.get("productVersionId") ?? undefined;

    const media = await prisma.media.findMany({
      where: {
        productId: params.id,
        observationId,
        productVersionId,
      },
      select: {
        id: true,
        imageType: true,
        description: true,
        locationArea: true,
        isMasterReference: true,
        uploadedAt: true,
        uploadedBy: { select: { name: true } },
        productVersion: { select: { versionNumber: true } },
      },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json({ media });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const { userId } = await requirePermission("media.upload");

    const product = await prisma.product.findUnique({ where: { id: params.id } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A 'file' field with the image is required" }, { status: 400 });
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Accepted: ${ACCEPTED_IMAGE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large (max 15 MB)" }, { status: 400 });
    }

    const metadataRaw = {
      productVersionId: formData.get("productVersionId") || undefined,
      productionBatchId: formData.get("productionBatchId") || undefined,
      observationId: formData.get("observationId") || undefined,
      imageType: formData.get("imageType") || undefined,
      description: formData.get("description") || undefined,
      locationArea: formData.get("locationArea") || undefined,
      isMasterReference: formData.get("isMasterReference") || undefined,
      parentMediaId: formData.get("parentMediaId") || undefined,
    };
    const parsed = uploadMediaMetadataSchema.safeParse(metadataRaw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Cross-checks: if a version/batch/observation is referenced, it must
    // actually belong to this product — every image must be traceable to
    // the correct product, not just "some" object (Section 10).
    if (parsed.data.productVersionId) {
      const v = await prisma.productVersion.findFirst({
        where: { id: parsed.data.productVersionId, productId: params.id },
      });
      if (!v) return NextResponse.json({ error: "Version not found on this product" }, { status: 400 });
    }
    if (parsed.data.productionBatchId) {
      const b = await prisma.productionBatch.findFirst({
        where: { id: parsed.data.productionBatchId, productId: params.id },
      });
      if (!b) return NextResponse.json({ error: "Batch not found on this product" }, { status: 400 });
    }
    if (parsed.data.observationId) {
      const o = await prisma.observation.findFirst({
        where: { id: parsed.data.observationId, productId: params.id },
      });
      if (!o) return NextResponse.json({ error: "Observation not found on this product" }, { status: 400 });
    }
    if (parsed.data.parentMediaId) {
      const parent = await prisma.media.findFirst({
        where: { id: parsed.data.parentMediaId, productId: params.id },
      });
      if (!parent) return NextResponse.json({ error: "Original photo not found on this product" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const storageKey = generateMediaKey(product.productId, extension);
    const thumbKey = thumbnailKeyFor(storageKey);

    // Thumbnail generated server-side so the mobile gallery and desktop
    // tables load fast — original stays untouched (Section 10).
    const thumbnailBuffer = await sharp(originalBuffer)
      .rotate() // respects EXIF orientation from phone cameras
      .resize({ width: 400, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const storage = await getStorageDriver();
    await storage.putObject(storageKey, originalBuffer, file.type);
    await storage.putObject(thumbKey, thumbnailBuffer, "image/jpeg");

    const created = await prisma.$transaction(async (tx) => {
      const media = await tx.media.create({
        data: {
          storageKey,
          thumbnailKey: thumbKey,
          productId: params.id,
          productVersionId: parsed.data.productVersionId,
          productionBatchId: parsed.data.productionBatchId,
          observationId: parsed.data.observationId,
          uploadedById: userId,
          imageType: parsed.data.imageType,
          description: parsed.data.description,
          locationArea: parsed.data.locationArea,
          isMasterReference: parsed.data.isMasterReference,
          parentMediaId: parsed.data.parentMediaId,
        },
      });

      await writeAuditLog(tx, {
        userId,
        action: "UPLOAD_MEDIA",
        objectType: "Media",
        objectId: media.id,
        newValue: {
          productId: params.id,
          imageType: parsed.data.imageType,
          locationArea: parsed.data.locationArea,
        },
      });

      return media;
    });

    return NextResponse.json(
      { id: created.id, imageType: created.imageType, uploadedAt: created.uploadedAt },
      { status: 201 }
    );
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
