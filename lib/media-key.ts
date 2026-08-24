import { randomUUID } from "crypto";

/**
 * Storage keys are namespaced by product so a human browsing the bucket
 * (real S3 later) can still make sense of it, and scoped with a random UUID
 * so filenames never collide and never leak the original filename.
 */
export function generateMediaKey(productId: string, extension: string): string {
  return `products/${productId}/${randomUUID()}.${extension}`;
}

export function thumbnailKeyFor(originalKey: string): string {
  const parts = originalKey.split(".");
  parts.pop();
  // Thumbnails are always re-encoded as JPEG (see the upload route), so the
  // key always ends in .jpg regardless of the original's format — content
  // type is still stored correctly per-file via the storage driver's sidecar,
  // this just keeps the filename honest.
  return `${parts.join(".")}-thumb.jpg`;
}
