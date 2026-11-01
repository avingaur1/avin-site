import Image from "next/image";
import type { Photo } from "@/content/site";

// Static export doesn't add the GitHub Pages base path to image URLs, so do it here.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * A small row of photos. Empty `src` renders a quiet placeholder frame,
 * so the layout holds its shape until real photos are added.
 */
export function PhotoStrip({
  photos,
  placeholders = false,
}: {
  photos: Photo[];
  placeholders?: boolean;
}) {
  const items = placeholders ? photos : photos.filter((p) => p.src);
  if (items.length === 0) return null;

  return (
    <ul className="grid grid-cols-3 gap-2 sm:gap-3">
      {items.map((p, i) => (
        <li key={i}>
          <figure>
            {p.src ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-[4px] bg-placeholder">
                <Image
                  src={p.src.startsWith("/") ? `${BASE}${p.src}` : p.src}
                  alt={p.alt ?? ""}
                  fill
                  sizes="(min-width: 780px) 240px, 33vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <div
                className="theme-fade flex aspect-[4/3] items-center justify-center rounded-[4px] border border-dashed border-line bg-placeholder"
                aria-hidden
              >
                <span className="text-[12px] text-muted">photo soon</span>
              </div>
            )}
            {p.caption && (
              <figcaption className="mt-2 text-[13px] leading-snug text-muted">
                {p.caption}
              </figcaption>
            )}
          </figure>
        </li>
      ))}
    </ul>
  );
}
