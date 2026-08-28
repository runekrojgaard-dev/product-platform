import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/authorize";
import { writeAuditLog } from "@/lib/audit";
import { parseProjectsWorkbook } from "@/lib/excel-import";
import { extractEmbeddedImages } from "@/lib/excel-image-extract";
import { generateProductId } from "@/lib/product-id";
import { generateMediaKey, thumbnailKeyFor } from "@/lib/media-key";
import { getStorageDriver } from "@/lib/storage";

const ACCEPTED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
];

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requirePermission("project.manage");

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A 'file' field with the spreadsheet is required" }, { status: 400 });
    }
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.xlsx?$/i)) {
      return NextResponse.json({ error: "File must be an .xlsx or .xls spreadsheet" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, errors: parseErrors } = parseProjectsWorkbook(buffer);

    // Only .xlsx (not the older .xls format) is a zip archive internally,
    // so embedded-image extraction only works for .xlsx uploads. .xls files
    // still import fine — they just won't carry photos.
    const isXlsx = file.name.match(/\.xlsx$/i) || file.type.includes("spreadsheetml");
    const images = isXlsx ? await extractEmbeddedImages(buffer) : [];
    const imagesByRow = new Map(images.map((img) => [img.rowIndex + 1, img]));

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid project rows found. Expected columns: 'Project Name', 'Customer', 'Status' (optional), and optionally 'Product Number', 'Product Name', 'Category'.",
          details: parseErrors,
        },
        { status: 400 }
      );
    }

    const createdProjects: string[] = [];
    const createdProducts: string[] = [];
    let photosAttached = 0;
    const skipped: { rowNumber: number; reason: string }[] = [];
    const storage = await getStorageDriver();

    // Image processing (thumbnailing, storage writes) happens outside the
    // DB transaction — those are slow I/O operations and Prisma transactions
    // have a time budget; only the database writes themselves are atomic.
    type PendingImage = { productDbId: string; productCode: string; buffer: Buffer; contentType: string };
    const pendingImages: PendingImage[] = [];

    await prisma.$transaction(async (tx) => {
      const customerCache = new Map<string, string>();

      for (const row of rows) {
        const customerKey = row.customerName.toLowerCase();
        let customerId = customerCache.get(customerKey);

        if (!customerId) {
          const existing = await tx.customer.findFirst({
            where: { name: { equals: row.customerName, mode: "insensitive" } },
          });
          customerId = existing ? existing.id : (await tx.customer.create({ data: { name: row.customerName } })).id;
          customerCache.set(customerKey, customerId);
        }

        let project = await tx.project.findFirst({
          where: { name: { equals: row.projectName, mode: "insensitive" }, customerId },
        });
        if (!project) {
          project = await tx.project.create({
            data: { name: row.projectName, customerId, status: row.status },
          });
          createdProjects.push(project.name);
        }

        if (!row.product) continue;

        const existingProduct = await tx.product.findFirst({
          where: { productNumber: row.product.productNumber, projectId: project.id },
        });
        if (existingProduct) {
          skipped.push({
            rowNumber: row.rowNumber,
            reason: `Product "${row.product.productNumber}" already exists in this project`,
          });
          continue;
        }

        const productId = await generateProductId(tx, row.product.category);
        const product = await tx.product.create({
          data: {
            productId,
            productNumber: row.product.productNumber,
            name: row.product.productName,
            category: row.product.category,
            projectId: project.id,
            createdById: userId,
            status: "FIRST_PROTOTYPE",
          },
        });
        createdProducts.push(`${product.productId} — ${product.name}`);

        const image = imagesByRow.get(row.rowNumber);
        if (image) {
          pendingImages.push({
            productDbId: product.id,
            productCode: product.productId,
            buffer: image.buffer,
            contentType: image.contentType,
          });
        }
      }

      await writeAuditLog(tx, {
        userId,
        action: "BULK_IMPORT_PROJECTS",
        objectType: "Project",
        objectId: "bulk-import",
        newValue: {
          createdProjects: createdProjects.length,
          createdProducts: createdProducts.length,
          fileName: file.name,
        },
      });
    });

    // Now handle image storage + Media rows for any products that got a
    // photo, outside the main transaction (see note above).
    for (const pending of pendingImages) {
      try {
        const extension = pending.contentType === "image/png" ? "png" : "jpg";
        const storageKey = generateMediaKey(pending.productCode, extension);
        const thumbKey = thumbnailKeyFor(storageKey);

        const thumbnailBuffer = await sharp(pending.buffer)
          .rotate()
          .resize({ width: 400, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();

        await storage.putObject(storageKey, pending.buffer, pending.contentType);
        await storage.putObject(thumbKey, thumbnailBuffer, "image/jpeg");

        await prisma.media.create({
          data: {
            storageKey,
            thumbnailKey: thumbKey,
            productId: pending.productDbId,
            uploadedById: userId,
            imageType: "Reference",
            description: "Imported from Excel",
          },
        });
        photosAttached += 1;
      } catch (err) {
        // A single bad image shouldn't fail the whole import — the product
        // itself is already safely created either way.
        console.error(`Failed to attach imported photo for ${pending.productCode}`, err);
      }
    }

    return NextResponse.json({
      createdProjectsCount: createdProjects.length,
      createdProjects,
      createdProductsCount: createdProducts.length,
      createdProducts,
      photosAttached,
      skipped,
      parseErrors,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

