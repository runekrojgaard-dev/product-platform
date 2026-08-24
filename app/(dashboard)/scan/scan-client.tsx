"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ScanClient() {
  const router = useRouter();
  const scannerContainerId = "qr-scanner-region";
  const scannerRef = useRef<import("html5-qrcode").Html5QrcodeScanner | null>(null);
  const resolvingRef = useRef(false);

  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);

  async function resolveProductId(rawCode: string) {
    if (resolvingRef.current) return;
    const code = rawCode.trim();
    if (!code) return;

    resolvingRef.current = true;
    setResolving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/products/lookup?productId=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Product not found");
        resolvingRef.current = false;
        setResolving(false);
        return;
      }
      router.push(`/products/${data.id}`);
    } catch {
      setError("Could not reach the server. Check your connection.");
      resolvingRef.current = false;
      setResolving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    import("html5-qrcode")
      .then(({ Html5QrcodeScanner }) => {
        if (cancelled) return;
        const scanner = new Html5QrcodeScanner(
          scannerContainerId,
          { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
          /* verbose= */ false
        );
        scannerRef.current = scanner;

        scanner.render(
          (decodedText) => {
            resolveProductId(decodedText);
          },
          () => {
            // Per-frame "no QR found" callback — expected constantly while
            // aiming the camera, intentionally not surfaced as an error.
          }
        );
      })
      .catch(() => {
        if (!cancelled) setCameraFailed(true);
      });

    return () => {
      cancelled = true;
      scannerRef.current?.clear().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scanner is set up once; resolveProductId is stable enough for this lifecycle
  }, []);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    resolveProductId(manualCode);
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-lg font-semibold text-neutral-900 mb-1">Scan Product</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Point the camera at the product&apos;s QR label, or type the Product ID below.
      </p>

      {!cameraFailed && (
        <div className="mb-6 rounded-lg overflow-hidden border border-neutral-200">
          <div id={scannerContainerId} />
        </div>
      )}

      {cameraFailed && (
        <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2 mb-6">
          Camera scanning isn&apos;t available on this device/browser. Use manual entry below.
        </p>
      )}

      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="e.g. CHR-00482"
          className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm font-mono"
        />
        <button
          disabled={resolving}
          className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
        >
          {resolving ? "Looking up…" : "Open"}
        </button>
      </form>

      {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
    </div>
  );
}
