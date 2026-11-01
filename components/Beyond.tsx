import { site } from "@/content/site";
import type { GalleryPhoto } from "./Gallery";
import { BeyondView } from "./views/BeyondView";
import { imageSize } from "@/lib/imageSize";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function Beyond() {
  const { heading, description, items, photos, interactiveResume } = site.beyond;

  // Every photo in the gallery list that has a file, in the editor's order.
  const gallery: GalleryPhoto[] = photos
    .filter((p) => p.src)
    .map((p) => {
      const src = p.src as string;
      const local = src.startsWith("/");
      const size = local ? imageSize(src) : null;
      return {
        src: local ? `${BASE}${src}` : src,
        alt: p.alt ?? "",
        caption: p.caption,
        width: size?.width,
        height: size?.height,
      };
    });
  return (
    <BeyondView
      heading={heading}
      description={description}
      items={items}
      gallery={gallery}
      interactiveResume={interactiveResume}
    />
  );
}
