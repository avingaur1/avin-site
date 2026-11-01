export const dynamic = "force-static";

import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { getPublishedThoughts } from "@/lib/thoughts";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url, changeFrequency: "monthly", priority: 1 },
    ...getPublishedThoughts().map((t) => ({
      url: `${site.url}/thoughts/${t.slug}`,
      lastModified: t.date,
    })),
  ];
}
