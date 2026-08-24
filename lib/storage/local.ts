import { promises as fs } from "fs";
import path from "path";
import type { StorageDriver } from "./index";

// Deliberately OUTSIDE /public — files are only reachable through our own
// API routes, which enforce the same role-based access control as
// everything else (architecture doc Section 28: "never trust client-side
// authorization alone", and files are no exception).
const ROOT = path.join(process.cwd(), "storage", "uploads");

const CONTENT_TYPE_SIDECAR_SUFFIX = ".contenttype";

export class LocalStorageDriver implements StorageDriver {
  private async resolvePath(key: string): Promise<string> {
    // Basic traversal guard — keys are generated server-side (see
    // lib/media-key.ts) and never taken verbatim from client input, but this
    // is a cheap extra guard against a future caller doing that by mistake.
    const safeKey = key.replace(/\.\./g, "");
    const full = path.join(ROOT, safeKey);
    await fs.mkdir(path.dirname(full), { recursive: true });
    return full;
  }

  async putObject(key: string, data: Buffer, contentType: string): Promise<string> {
    const full = await this.resolvePath(key);
    await fs.writeFile(full, data);
    await fs.writeFile(full + CONTENT_TYPE_SIDECAR_SUFFIX, contentType, "utf-8");
    return key;
  }

  async getObject(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    try {
      const full = await this.resolvePath(key);
      const data = await fs.readFile(full);
      let contentType = "application/octet-stream";
      try {
        contentType = await fs.readFile(full + CONTENT_TYPE_SIDECAR_SUFFIX, "utf-8");
      } catch {
        // no sidecar — fall back to generic content type
      }
      return { data, contentType };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const full = await this.resolvePath(key);
    await fs.rm(full, { force: true });
    await fs.rm(full + CONTENT_TYPE_SIDECAR_SUFFIX, { force: true });
  }
}
