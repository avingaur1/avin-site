import { ArrowUpRight } from "lucide-react";
import { site, type WorkEntry } from "@/content/site";
import { Section } from "./Section";

function Row({ entry }: { entry: WorkEntry }) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        {/* Period sits on the right on wider screens and drops below the title on phones. */}
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h3 className="font-medium text-fg transition-colors duration-150 group-hover:text-accent">
            {entry.title}
          </h3>
          {entry.period && (
            <span className="shrink-0 text-[13px] tabular-nums text-muted">{entry.period}</span>
          )}
        </div>
        {entry.role && <p className="text-[14px] text-fg/80">{entry.role}</p>}
        {entry.description && (
          <p className="mt-0.5 text-[14px] leading-[1.6] text-muted">{entry.description}</p>
        )}
      </div>
      {entry.href && (
        <ArrowUpRight
          size={16}
          strokeWidth={1.75}
          aria-hidden
          className="mt-1 shrink-0 text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
        />
      )}
    </>
  );

  const cls = "group flex items-start justify-between gap-6 py-5";

  return (
    <li className="border-t border-line first:border-t-0 first:pt-0">
      {entry.href ? (
        <a
          href={entry.href}
          target={entry.href.startsWith("http") ? "_blank" : undefined}
          rel={entry.href.startsWith("http") ? "noopener noreferrer" : undefined}
          className={cls}
        >
          {body}
        </a>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

export function Work() {
  const { heading, subheading, entries } = site.work;
  return (
    <Section id="work" heading={heading} subheading={subheading}>
      <ul className="-mt-5">
        {entries.map((e) => (
          <Row key={e.title} entry={e} />
        ))}
      </ul>
    </Section>
  );
}
