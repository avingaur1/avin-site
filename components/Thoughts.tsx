import Link from "next/link";
import { site } from "@/content/site";
import { formatDate, getDraftThoughts, getPublishedThoughts } from "@/lib/thoughts";
import { Section } from "./Section";

export function Thoughts() {
  const { heading, subheading, emptyMessage } = site.thoughts;
  const published = getPublishedThoughts();
  const drafts = getDraftThoughts();

  return (
    <Section id="thoughts" heading={heading} subheading={subheading}>
      {published.length > 0 ? (
        <ul>
          {published.map((t) => (
            <li key={t.slug} className="border-t border-line first:border-t-0">
              <Link
                href={`/thoughts/${t.slug}`}
                className="group flex flex-col gap-0.5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <span className="transition-colors duration-150 group-hover:text-accent">
                  {t.title}
                </span>
                <time dateTime={t.date} className="shrink-0 text-[14px] tabular-nums text-muted">
                  {formatDate(t.date)}
                </time>
              </Link>
            </li>
          ))}
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
