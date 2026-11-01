/**
 * The site's words, photos and links live in site.json.
 * Edit them from the editor at /admin, or directly in site.json.
 * This file only gives that data its shape and fills in safe defaults,
 * so a missing field in the editor never breaks the page.
 *
 * Articles live as Markdown files in /content/thoughts.
 */
import data from "./site.json";

export type Photo = {
  /** Path inside /public, e.g. "/images/campus-1.webp" */
  src?: string;
  alt?: string;
  caption?: string;
};

export type WorkEntry = {
  title: string;
  role?: string;
  /** e.g. "Jun – Aug 2026" or "2027 – present". Shown in small grey text. */
  period?: string;
  description?: string;
  /** If set, the row becomes a link and shows a small arrow. */
  href?: string;
};

export type CampusEntry = {
  title: string;
  paragraphs?: string[];
  photos?: Photo[];
};

export type BeyondItem = {
  label: string;
  /** Rows with empty text are hidden. */
  text?: string;
  href?: string;
};

export type LinkItem = { label: string; href?: string };

// Read loosely: the editor may leave optional fields out entirely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const d: any = data;

export const site = {
  name: "Avin Gaur",
  url: (d.url || "https://avingaur1.github.io/avin-site").replace(/\/$/, ""),
  description: d.description ?? "",

  // Navigation is part of the design, so it stays in code.
  nav: [
    { label: "work", href: "#work" },
    { label: "campus", href: "#campus" },
    { label: "thoughts", href: "#thoughts" },
    { label: "about", href: "#beyond" },
  ],

  intro: {
    heading: d.intro?.heading || "Avin Gaur.",
    lines: (d.intro?.lines ?? []) as string[],
  },

  work: {
    heading: d.work?.heading || "Work",
    subheading: d.work?.subheading ?? "",
    entries: (d.work?.entries ?? []) as WorkEntry[],
  },

  campus: {
    heading: d.campus?.heading || "My Journey at Campus",
    intro: d.campus?.intro ?? "",
    entries: (d.campus?.entries ?? []) as CampusEntry[],
  },

  thoughts: {
    heading: d.thoughts?.heading || "Thoughts",
    subheading: d.thoughts?.subheading ?? "",
    /** Medium username (without @). Its latest posts are listed alongside your own. */
    mediumUsername: (d.thoughts?.mediumUsername ?? "") as string,
    emptyMessage: d.thoughts?.emptyMessage || "Some thoughts are taking shape.",
  },

  beyond: {
    heading: d.beyond?.heading || "Beyond the Resume",
    description: d.beyond?.description ?? "",
    items: (d.beyond?.items ?? []) as BeyondItem[],
    photos: (d.beyond?.photos ?? []) as Photo[],
    interactiveResume: {
      label: d.beyond?.interactiveResume?.label || "Explore my interactive resume",
      href: (d.beyond?.interactiveResume?.href ?? "") as string,
    },
  },

  connect: {
    heading: d.connect?.heading || "Let's Connect",
    text: d.connect?.text ?? "",
    links: ((d.connect?.links ?? []) as LinkItem[]).map((l) => ({
      label: l.label,
      href: l.href ?? "",
    })),
  },

  footer: {
    left: d.footer?.left ?? "© 2026 Avin Gaur",
    right: d.footer?.right ?? "Made with curiosity.",
  },
};
