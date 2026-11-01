/**
 * Pulls recent posts from a Medium profile's RSS feed at build time.
 * Medium's feed only includes the latest ~10 posts.
 * If Medium can't be reached, the site still builds; those posts are just left out.
 */

export type ExternalPost = {
  title: string;
  url: string;
  date: string; // YYYY-MM-DD
  source: "Medium";
};

function decode(s: string) {
  return s
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .trim();
}

function tag(item: string, name: string) {
  const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
}

export async function getMediumPosts(username?: string): Promise<ExternalPost[]> {
  const handle = (username || "").trim().replace(/^@/, "");
  if (!handle) return [];

  // MEDIUM_FEED_URL lets the feed be swapped out for testing.
  const feedUrl = process.env.MEDIUM_FEED_URL || `https://medium.com/feed/@${handle}`;

  try {
    const res = await fetch(feedUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0 (personal site build)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map(([, item]) => {
        const title = tag(item, "title");
        const url = tag(item, "link").split("?")[0];
        const d = new Date(tag(item, "pubDate"));
        return {
          title,
          url,
          date: Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10),
          source: "Medium" as const,
        };
      })
      .filter((p) => p.title && p.url.startsWith("http") && p.date);
  } catch (err) {
    console.warn(`[medium] Could not load posts for @${handle}: ${(err as Error).message}`);
    return [];
  }
}
