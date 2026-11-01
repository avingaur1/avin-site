import { site, type CampusEntry } from "@/content/site";
import { Section } from "./Section";
import { PhotoStrip } from "./Photos";

export function Campus() {
  return <CampusView {...site.campus} />;
}

/** Pure view, also used by the editor's preview. */
export function CampusView({
  heading,
  intro,
  entries,
}: {
  heading: string;
  intro: string;
  entries: CampusEntry[];
}) {
  return (
    <Section id="campus" heading={heading}>
      <p className="-mt-2 max-w-[640px]">{intro}</p>

      <div className="mt-10 space-y-10">
        {entries.map((e) => (
          <article key={e.title} className="grid gap-2 md:grid-cols-[200px_1fr] md:gap-8">
            <h3 className="font-medium">
              {e.href ? (
                <a
                  href={e.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group text-fg hover:text-accent"
                >
                  {e.title}
                  <span
                    aria-hidden
                    className="ml-1 inline-block text-[13px] font-normal text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                  >
                    ↗
                  </span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                e.title
              )}
            </h3>
            <div className="space-y-3">
              {(e.paragraphs ?? []).map((p, i) => (
                <p key={i} className="text-muted">
                  {p}
                </p>
              ))}
              {e.photos && e.photos.some((p) => p.src) && (
                <div className="pt-3">
                  <PhotoStrip photos={e.photos} />
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
