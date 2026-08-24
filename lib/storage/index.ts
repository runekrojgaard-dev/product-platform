/**
 * Object storage abstraction (architecture doc Section 27: "Images and
 * documents should not be stored directly inside normal database records...
 * use proper object/file storage").
 *
 * This interface is the seam for swapping the local filesystem driver
 * (used in this build environment and fine for local dev) for a real
 * S3-compatible driver in production, without touching any call site.
 * Selected via STORAGE_DRIVER env var.
 */
export interface StorageDriver {
  /** Stores a buffer under `key` and returns the key (unchanged) for DB storage. */
  putObject(key: string, data: Buffer, contentType: string): Promise<string>;
  getObject(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  deleteObject(key: string): Promise<void>;
}

let driver: StorageDriver | null = null;

export async function getStorageDriver(): Promise<StorageDriver> {
  if (driver) return driver;

  const kind = process.env.STORAGE_DRIVER || "local";
  if (kind === "s3") {
    // Not implemented in this build — see lib/storage/s3.example.ts for the
    // shape to fill in with @aws-sdk/client-s3 and signed URLs. Swapping
    // this in requires no changes to any API route, only this function.
    throw new Error(
      "STORAGE_DRIVER=s3 is not implemented yet. See lib/storage/s3.example.ts."
    );
  }

  const { LocalStorageDriver } = await import("./local");
  driver = new LocalStorageDriver();
  return driver;
}
