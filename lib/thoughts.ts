import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

const DIR = path.join(process.cwd(), "content", "thoughts");

export type Thought = {
  slug: string;
  title: string;
  date: string;
  draft: boolean;
  summary?: string;
};

function readAll(): (Thought & { body: string })[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(DIR, file), "utf8");
      const { data, content } = matter(raw);
      return {
        slug: file.replace(/\.md$/, ""),
        title: String(data.title ?? file),
        date: data.date ? String(data.date) : "",
        draft: data.draft !== false || !data.date,
        summary: data.summary ? String(data.summary) : undefined,
        body: content,
      };
    });
}

/** Published = draft: false AND has a date. Newest first. */
export function getPublishedThoughts(): Thought[] {
  return readAll()
    .filter((t) => !t.draft)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(({ body: _body, ...t }) => t);
}

export function getDraftThoughts(): Thought[] {
  return readAll()
    .filter((t) => t.draft)
    .map(({ body: _body, ...t }) => t);
}

export async function getThought(slug: string) {
  const t = readAll().find((x) => x.slug === slug && !x.draft);
  if (!t) return null;
  // Images uploaded from the editor are saved as "/images/…"; add the
  // GitHub Pages base path so they also load on username.github.io/repo.
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const html = (await marked.parse(t.body)).replace(
    /(<img[^>]*\ssrc=")\/(?!\/)/g,
    `$1${base}/`,
  );
  return { ...t, html };
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
