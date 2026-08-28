import JSZip from "jszip";

export type ExtractedImage = {
  /** 0-indexed row within the sheet (row 0 = the header row). */
  rowIndex: number;
  buffer: Buffer;
  contentType: string;
  extension: string;
};

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
};

/**
 * An .xlsx file is a zip archive. Images pasted into cells are stored as
 * separate files under xl/media/, and xl/drawings/drawingN.xml records
 * which cell (row/column anchor) each image was placed at, linked via
 * xl/drawings/_rels/drawingN.xml.rels. This walks that structure directly
 * rather than relying on a library, since the general-purpose xlsx parser
 * this app already uses (SheetJS community edition) doesn't read images at
 * all — that's a paid-tier feature there.
 *
 * Only the first sheet's first drawing is read, matching the assumption
 * already made elsewhere in this import feature (single-sheet uploads).
 */
export async function extractEmbeddedImages(buffer: Buffer): Promise<ExtractedImage[]> {
  const zip = await JSZip.loadAsync(buffer);

  const drawingFile = Object.keys(zip.files).find((name) =>
    /^xl\/drawings\/drawing\d+\.xml$/.test(name)
  );
  if (!drawingFile) return [];

  const relsFile = drawingFile.replace("drawings/", "drawings/_rels/") + ".rels";
  const drawingXml = await zip.file(drawingFile)?.async("string");
  const relsXml = await zip.file(relsFile)?.async("string");
  if (!drawingXml || !relsXml) return [];

  // Map relationship id -> media file path, e.g. rId1 -> xl/media/image1.png.
  // Targets vary by producer: real Excel typically writes relative paths
  // like "../media/image1.png"; other tools (e.g. openpyxl) write absolute
  // paths like "/xl/media/image1.png". Handle both.
  const relIdToMedia = new Map<string, string>();
  const relTagRegex = /<Relationship\b[^>]*\/?>/g;
  let relTagMatch: RegExpExecArray | null;
  while ((relTagMatch = relTagRegex.exec(relsXml))) {
    const tag = relTagMatch[0];
    const idMatch = /\bId="(rId\d+)"/.exec(tag);
    const targetMatch = /\bTarget="([^"]+)"/.exec(tag);
    if (!idMatch || !targetMatch) continue;

    const target = targetMatch[1];
    let resolved: string;
    if (target.startsWith("/")) {
      resolved = target.slice(1); // "/xl/media/image1.png" -> "xl/media/image1.png"
    } else {
      // Relative to xl/drawings/ — resolve "../media/image1.png" etc.
      const parts = ("xl/drawings/" + target).split("/");
      const stack: string[] = [];
      for (const part of parts) {
        if (part === "..") stack.pop();
        else if (part !== "." && part !== "") stack.push(part);
      }
      resolved = stack.join("/");
    }
    relIdToMedia.set(idMatch[1], resolved);
  }

  // Each anchor block contains a <from><row> (0-indexed row) and a
  // <a:blip r:embed="rIdN"/> pointing at the image. Namespace prefixes on
  // these elements vary by producer (some use "xdr:", some use none at
  // all with a default namespace) so prefixes are matched loosely here
  // rather than assumed.
  const images: ExtractedImage[] = [];
  const anchorRegex = /<(?:\w+:)?(?:twoCellAnchor|oneCellAnchor)[\s\S]*?<\/(?:\w+:)?(?:twoCellAnchor|oneCellAnchor)>/g;
  let anchorMatch: RegExpExecArray | null;

  while ((anchorMatch = anchorRegex.exec(drawingXml))) {
    const block = anchorMatch[0];
    const rowMatch = /<(?:\w+:)?from>[\s\S]*?<(?:\w+:)?row>(\d+)<\/(?:\w+:)?row>/.exec(block);
    const embedMatch = /r:embed="(rId\d+)"/.exec(block);
    if (!rowMatch || !embedMatch) continue;

    const rowIndex = Number(rowMatch[1]);
    const mediaPath = relIdToMedia.get(embedMatch[1]);
    if (!mediaPath) continue;

    const file = zip.file(mediaPath);
    if (!file) continue;

    const extension = (mediaPath.split(".").pop() ?? "png").toLowerCase();
    const contentType = EXT_TO_CONTENT_TYPE[extension] ?? "image/png";
    const imageBuffer = await file.async("nodebuffer");

    images.push({ rowIndex, buffer: imageBuffer, contentType, extension });
  }

  return images;
}
