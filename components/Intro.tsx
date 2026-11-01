import { site } from "@/content/site";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function Intro() {
  const { heading, lines, portrait } = site.intro;
  const photo = portrait.src
    ? { src: portrait.src.startsWith("/") ? `${BASE}${portrait.src}` : portrait.src, alt: portrait.alt }
    : null;

  return (
    <section id="top" aria-label="Introduction" className="pb-16 pt-16 md:pb-20 md:pt-24">
      {/* Text on the left, a small portrait on the right; stacks on phones.
          With no portrait set, the text simply takes the full width as before. */}
      <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between md:gap-14">
        <div className="min-w-0">
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] md:text-[56px]">
            {heading}
          </h1>
          <div className="mt-7 max-w-[600px] space-y-4 md:mt-8">
            <p className="text-[18px] leading-[1.6] md:text-[19px]">{lines[0]}</p>
            {lines.slice(1).map((line) => (
              <p key={line} className="text-muted">
                {line}
              </p>
            ))}
          </div>
        </div>

        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.src}
            alt={photo.alt}
            width={600}
            height={800}
            fetchPriority="high"
            className="aspect-[3/4] w-32 shrink-0 rounded-[6px] bg-placeholder object-cover sm:w-36 md:mt-2 md:w-[168px]"
          />
        )}
      </div>
    </section>
  );
}
