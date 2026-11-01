import Link from "next/link";
import { site } from "@/content/site";
import { formatDate, getDraftThoughts, getPublishedThoughts } from "@/lib/thoughts";
import { getMediumPosts } from "@/lib/medium";
import { Section } from "./Section";

type Row = {
  key: string;
  title: string;
  date: string;
  href: string;
  /** Set for posts that live on another site (e.g. Medium). */
  source?: string;
};

const rowClass =
  "group flex flex-col gap-0.5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6";

export async function Thoughts() {
  const { heading, subheading, emptyMessage, mediumUsername } = site.thoughts;
  const drafts = getDraftThoughts();

  const own: Row[] = getPublishedThoughts().map((t) => ({
    key: t.slug,
    title: t.title,
    date: t.date,
    href: `/thoughts/${t.slug}`,
  }));
  const medium: Row[] = (await getMediumPosts(mediumUsername)).map((p) => ({
    key: p.url,
    title: p.title,
    date: p.date,
    href: p.url,
    source: p.source,
  }));
  const rows = [...own, ...medium].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <Section id="thoughts" heading={heading} subheading={subheading}>
      {rows.length > 0 ? (
        <ul>
          {rows.map((r) => {
            const inner = (
              <>
                <span className="transition-colors duration-150 group-hover:text-accent">
                  {r.title}
                  {r.source && (
                    <>
                      <span
                        aria-hidden
                        className="ml-1 inline-block text-[13px] text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                      >
                        ↗
                      </span>
                      <span className="sr-only"> (on {r.source}, opens in a new tab)</span>
                    </>
                  )}
                </span>
                <span className="shrink-0 text-[14px] tabular-nums text-muted">
                  {r.source && <span aria-hidden>{r.source} · </span>}
                  <time dateTime={r.date}>{formatDate(r.date)}</time>
                </span>
              </>
            );
            return (
              <li key={r.key} className="border-t border-line first:border-t-0">
                {r.source ? (
                  <a href={r.href} target="_blank" rel="noopener noreferrer" className={rowClass}>
                    {inner}
                  </a>
                ) : (
                  <Link href={r.href} className={rowClass}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div>
          <p className="italic text-muted">{emptyMessage}</p>
          {drafts.length > 0 && (
            <div className="mt-6">
              <p className="text-[13px] uppercase tracking-[0.08em] text-muted">In the drafts</p>
              <ul className="mt-2">
                {drafts.map((t) => (
                  <li
                    key={t.slug}
                    className="flex items-baseline justify-between gap-6 border-t border-line py-3 first:border-t-0"
                  >
                    <span className="text-muted">{t.title}</span>
                    <span className="shrink-0 text-[13px] text-muted">draft</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
