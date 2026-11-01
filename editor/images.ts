/**
 * Shrinks a photo in the browser before upload: longest side at most 2000px,
 * saved as WebP (or JPEG where the browser can't make WebP, e.g. older Safari).
 * Redrawing also drops hidden metadata such as the GPS location phones embed.
 */
import { IMAGE_MAX_EDGE, IMAGE_QUALITY } from "./config";

export type Optimised = { blob: Blob; ext: "webp" | "jpg"; width: number; height: number };

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Fallback path some browsers need for certain files.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, q: number) {
  return new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
}

export async function optimise(file: File): Promise<Optimised> {
  if (file.size > 40_000_000) throw new Error("This photo is larger than 40 MB.");
  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await decode(file);
  } catch {
    const heic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
    throw new Error(
      heic
        ? "This browser can't open HEIC photos. Try uploading from your phone, or save it as JPEG first."
        : "This file couldn't be opened as a photo.",
    );
  }
  const w0 = "naturalWidth" in src ? src.naturalWidth : src.width;
  const h0 = "naturalHeight" in src ? src.naturalHeight : src.height;
  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(w0, h0));
  const width = Math.max(1, Math.round(w0 * scale));
  const height = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser couldn't process the photo.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, width, height);
  if ("close" in src) src.close();

  const webp = await toBlob(canvas, "image/webp", IMAGE_QUALITY);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp", width, height };
  const jpg = await toBlob(canvas, "image/jpeg", 0.85);
  if (!jpg) throw new Error("This browser couldn't process the photo.");
  return { blob: jpg, ext: "jpg", width, height };
}

/** "IMG 6401 (2).HEIC" → "img-6401-2" */
export function slugName(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "photo"
  );
}

/** A file name that doesn't clash with anything already in the folder. */
export function uniqueName(base: string, ext: string, taken: Set<string>) {
  let name = `${base}.${ext}`;
  let i = 2;
  while (taken.has(name.toLowerCase())) name = `${base}-${i++}.${ext}`;
  return name;
}
