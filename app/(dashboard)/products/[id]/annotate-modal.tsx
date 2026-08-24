"use client";

import { useEffect, useRef, useState } from "react";

type Tool = "circle" | "arrow" | "freehand" | "text";

type Shape =
  | { type: "CIRCLE"; x: number; y: number; rx: number; ry: number }
  | { type: "ARROW"; x1: number; y1: number; x2: number; y2: number }
  | { type: "FREEHAND"; points: { x: number; y: number }[] }
  | { type: "TEXT"; x: number; y: number; text: string };

// All coordinates are fractional (0-1) relative to the image's natural
// size, so annotations stay correctly placed regardless of display size
// (Section 11).

export function AnnotateModal({
  mediaId,
  productId,
  onClose,
  onSaved,
}: {
  mediaId: string;
  productId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>("circle");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [drawing, setDrawing] = useState<Shape | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      redraw();
    };
    img.src = `/api/v1/media/${mediaId}/file`;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loads once for this modal's lifetime
  }, [mediaId]);

  function redraw(preview?: Shape | null) {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    ctx.strokeStyle = "#ef4444";
    ctx.fillStyle = "#ef4444";
    ctx.lineWidth = Math.max(3, img.naturalWidth * 0.004);
    ctx.font = `${Math.round(img.naturalWidth * 0.03)}px sans-serif`;

    for (const shape of [...shapes, ...(preview ? [preview] : [])]) {
      drawShape(ctx, shape, canvas.width, canvas.height);
    }
  }

  function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, w: number, h: number) {
    if (shape.type === "CIRCLE") {
      ctx.beginPath();
      ctx.ellipse(shape.x * w, shape.y * h, Math.abs(shape.rx * w), Math.abs(shape.ry * h), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape.type === "ARROW") {
      const x1 = shape.x1 * w,
        y1 = shape.y1 * h,
        x2 = shape.x2 * w,
        y2 = shape.y2 * h;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = Math.max(12, w * 0.02);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else if (shape.type === "FREEHAND") {
      ctx.beginPath();
      shape.points.forEach((p, i) => {
        const x = p.x * w,
          y = p.y * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else if (shape.type === "TEXT") {
      ctx.fillText(shape.text, shape.x * w, shape.y * h);
    }
  }

  function relativePos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = relativePos(e);
    if (tool === "text") {
      const text = window.prompt("Annotation text:");
      if (text) {
        const shape: Shape = { type: "TEXT", x, y, text };
        setShapes((prev) => [...prev, shape]);
      }
      return;
    }
    if (tool === "circle") setDrawing({ type: "CIRCLE", x, y, rx: 0, ry: 0 });
    else if (tool === "arrow") setDrawing({ type: "ARROW", x1: x, y1: y, x2: x, y2: y });
    else if (tool === "freehand") setDrawing({ type: "FREEHAND", points: [{ x, y }] });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const { x, y } = relativePos(e);
    let next: Shape = drawing;
    if (drawing.type === "CIRCLE") next = { ...drawing, rx: x - drawing.x, ry: y - drawing.y };
    else if (drawing.type === "ARROW") next = { ...drawing, x2: x, y2: y };
    else if (drawing.type === "FREEHAND") next = { ...drawing, points: [...drawing.points, { x, y }] };
    setDrawing(next);
    redraw(next);
  }

  function handleMouseUp() {
    if (drawing) setShapes((prev) => [...prev, drawing]);
    setDrawing(null);
  }

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redraw reads shapes via closure each call
  }, [shapes]);

  function handleUndo() {
    setShapes((prev) => prev.slice(0, -1));
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || shapes.length === 0) {
      setError("Add at least one annotation before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not export annotated image");

      const formData = new FormData();
      formData.append("file", blob, "annotated.png");
      formData.append("parentMediaId", mediaId);
      formData.append("imageType", "Annotated");

      const uploadRes = await fetch(`/api/v1/products/${productId}/media`, {
        method: "POST",
        body: formData,
      });
      const uploaded = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploaded.error || "Failed to save annotated image");

      await fetch(`/api/v1/media/${uploaded.id}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annotations: shapes.map((s) => {
            if (s.type === "TEXT") return { type: "TEXT", geometry: { x: s.x, y: s.y }, textLabel: s.text };
            if (s.type === "CIRCLE") return { type: "CIRCLE", geometry: { x: s.x, y: s.y, rx: s.rx, ry: s.ry } };
            if (s.type === "ARROW") return { type: "ARROW", geometry: { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 } };
            return { type: "FREEHAND", geometry: { points: s.points } };
          }),
        }),
      });

      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-900">Annotate Photo</h3>
          <button onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-900">
            Close
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          {(["circle", "arrow", "freehand", "text"] as Tool[]).map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`text-xs font-medium px-3 py-1.5 rounded border ${
                tool === t ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-700"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button onClick={handleUndo} className="text-xs font-medium px-3 py-1.5 rounded border border-neutral-300">
            Undo
          </button>
        </div>

        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full border border-neutral-200 rounded cursor-crosshair touch-none"
        />

        {error && <p className="text-sm text-red-700 mt-2">{error}</p>}

        <div className="flex gap-2 mt-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-neutral-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save annotated copy"}
          </button>
          <button onClick={onClose} className="rounded border border-neutral-300 text-sm font-medium px-4 py-2">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
