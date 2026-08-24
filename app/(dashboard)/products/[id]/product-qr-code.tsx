"use client";

export function ProductQrCode({ productId, dbId }: { productId: string; dbId: string }) {
  const qrUrl = `/api/v1/products/${dbId}/qrcode`;

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4 flex items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic authenticated PNG from our own API, not an optimizable static asset */}
      <img src={qrUrl} alt={`QR code for ${productId}`} className="w-28 h-28 border border-neutral-100 rounded" />
      <div>
        <p className="text-sm font-medium text-neutral-900">{productId}</p>
        <p className="text-xs text-neutral-500 mt-0.5 mb-2">
          Print this on the product label. Scanning it opens this record directly.
        </p>
        <a
          href={qrUrl}
          download={`${productId}-qr.png`}
          className="text-xs font-medium text-neutral-700 border border-neutral-300 rounded px-2.5 py-1 hover:bg-neutral-100 inline-block"
        >
          Download PNG
        </a>
      </div>
    </div>
  );
}
