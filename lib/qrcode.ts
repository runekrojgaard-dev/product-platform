import QRCode from "qrcode";

/**
 * The QR code encodes the raw, permanent Product ID (e.g. "CHR-00482"), not
 * a URL. This means:
 * - Any generic QR scanner can read the ID off a printed label even outside
 *   this application.
 * - The app's own /scan flow decodes the same string and looks it up via
 *   /api/v1/products/lookup.
 * See architecture doc Section 9.
 */
export async function generateProductQrPng(productId: string): Promise<Buffer> {
  return QRCode.toBuffer(productId, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
}
