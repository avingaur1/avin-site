import { site } from "@/content/site";
import { Section } from "./Section";
import { PhotoStrip } from "./Photos";

export function Beyond() {
  const { heading, description, items, photos, interactiveResume } = site.beyond;
  return (
    <Section id="beyond" heading={heading}>
      <p className="-mt-2 max-w-[640px]">{description}</p>

      <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-[14px] font-medium">{item.label}</dt>
            <dd className="text-[14px] text-muted">
              {item.text ? (
                item.href ? (
                  <a href={item.href} className="hover:text-accent">
                    {item.text}
                  </a>
                ) : (
                  item.text
                )
              ) : (
                <span className="italic">Coming soon</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-10">
        <PhotoStrip photos={photos} placeholders />
      </div>

      {interactiveResume.href && (
        <p className="mt-8">
          <a
            href={interactiveResume.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-baseline gap-1 text-accent underline decoration-transparent underline-offset-4 hover:decoration-current"
          >
            {interactiveResume.label}
            <span aria-hidden className="inline-block transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
              ↗
            </span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </p>
      )}
    </Section>
  );
}
