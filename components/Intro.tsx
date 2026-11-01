import { site } from "@/content/site";
import { imageSize } from "@/lib/imageSize";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function Intro() {
  const { heading, lines, portrait } = site.intro;
  const local = portrait.src.startsWith("/");
  const size = local ? imageSize(portrait.src) : null;
  const photo = portrait.src
    ? {
        src: local ? `${BASE}${portrait.src}` : portrait.src,
        alt: portrait.alt,
        width: size?.width ?? 600,
        height: size?.height ?? 800,
      }
    : null;

  return (
    <section
      id="top"
      aria-label="Introduction"
      className={`pt-16 md:pb-20 md:pt-24 ${photo ? "pb-12" : "pb-16"}`}
    >
      {/* Desktop: text on the left, a small portrait on the right.
          Phones: text stays left-aligned, the portrait sits centred below it.
          With no portrait set, the text simply takes the full width. */}
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between md:gap-14">
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
            width={photo.width}
            height={photo.height}
            fetchPriority="high"
            className="mx-auto h-auto w-[min(240px,100%)] shrink-0 rounded-[6px] bg-placeholder md:mx-0 md:mt-2 md:aspect-[3/4] md:w-[168px] md:object-cover"
          />
        )}
      </div>
    </section>
  );
}
