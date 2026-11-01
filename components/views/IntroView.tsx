/**
 * The homepage introduction, as a pure view.
 * Used by the live site (components/Intro.tsx) and by the editor's preview.
 */
export type IntroPhoto = { src: string; alt: string; width: number; height: number } | null;

export function IntroView({
  heading,
  lines,
  photo,
}: {
  heading: string;
  lines: string[];
  photo: IntroPhoto;
}) {
  return (
    <section
      id="top"
      aria-label="Introduction"
      className={`pt-16 md:pb-20 md:pt-24 ${photo ? "pb-12" : "pb-16"}`}
    >
      {/* One grid, two arrangements:
          - Phones (<768px): name and photo share the first row, vertically centred;
            the introduction runs full width underneath.
          - Desktop: name and introduction on the left, the photo on the right, top-aligned.
          The name column is minmax(0,1fr), so a long name wraps instead of ever overlapping the photo.
          With no portrait set, the text simply takes the full width. */}
      <div
        className={
          photo
            ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 md:grid-cols-[minmax(0,1fr)_168px] md:grid-rows-[auto_1fr] md:items-start md:gap-x-14"
            : ""
        }
      >
        <h1
          className={`font-semibold leading-[1.05] tracking-[-0.035em] md:text-[56px] ${
            photo ? "text-[clamp(30px,10vw,40px)]" : "text-[40px]"
          }`}
        >
          {heading}
        </h1>

        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.src}
            alt={photo.alt}
            width={photo.width}
            height={photo.height}
            fetchPriority="high"
            className="aspect-[3/4] w-[clamp(104px,31vw,124px)] rounded-[6px] bg-placeholder object-cover md:col-start-2 md:row-span-2 md:row-start-1 md:mt-2 md:w-[168px]"
          />
        )}

        <div
          className={`max-w-[600px] space-y-4 md:mt-8 ${
            photo ? "col-span-2 mt-7 md:col-span-1 md:col-start-1 md:row-start-2" : "mt-7"
          }`}
        >
          <p className="text-[18px] leading-[1.6] md:text-[19px]">{lines[0]}</p>
          {lines.slice(1).map((line) => (
            <p key={line} className="text-muted">
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
