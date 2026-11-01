import { site } from "@/content/site";
import { Section } from "./Section";
import { PhotoStrip } from "./Photos";

export function Campus() {
  const { heading, intro, entries } = site.campus;
  return (
    <Section id="campus" heading={heading}>
      <p className="-mt-2 max-w-[640px]">{intro}</p>

      <div className="mt-10 space-y-10">
        {entries.map((e) => (
          <article key={e.title} className="grid gap-2 md:grid-cols-[200px_1fr] md:gap-8">
            <h3 className="font-medium">{e.title}</h3>
            <div className="space-y-3">
              {e.paragraphs.map((p, i) => (
                <p key={i} className="text-muted">
                  {p}
                </p>
              ))}
              {e.photos && e.photos.length > 0 && (
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
