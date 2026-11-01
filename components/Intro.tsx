import { site } from "@/content/site";

export function Intro() {
  return (
    <section id="top" aria-label="Introduction" className="pb-16 pt-16 md:pb-20 md:pt-24">
      <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] md:text-[56px]">
        {site.intro.heading}
      </h1>
      <div className="mt-7 max-w-[600px] space-y-4 md:mt-8">
        <p className="text-[18px] leading-[1.6] md:text-[19px]">{site.intro.lines[0]}</p>
        {site.intro.lines.slice(1).map((line) => (
          <p key={line} className="text-muted">
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}
