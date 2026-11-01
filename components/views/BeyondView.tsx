import type { BeyondItem } from "@/content/site";
import { Section } from "../Section";
import { Gallery, type GalleryPhoto } from "../Gallery";

/**
 * Beyond the Resume, as a pure view.
 * Used by the live site (components/Beyond.tsx) and by the editor's preview.
 */
export function BeyondView({
  heading,
  description,
  items,
  gallery,
  interactiveResume,
}: {
  heading: string;
  description: string;
  items: BeyondItem[];
  gallery: GalleryPhoto[];
  interactiveResume: { label: string; href: string };
}) {
  const visible = items.filter((i) => i.text?.trim());
  return (
    <Section id="beyond" heading={heading}>
      <p className="-mt-2 max-w-[640px]">{description}</p>

      {/* Only rows with text are shown, so empty ones never look unfinished. */}
      {visible.length > 0 && (
        <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {visible.map((item) => {
            const external = item.href?.startsWith("http");
            return (
              <div key={item.label}>
                <dt className="text-[14px] font-medium">{item.label}</dt>
                <dd className="text-[14px] text-muted">
                  {item.href ? (
                    <a
                      href={item.href}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noopener noreferrer" : undefined}
                      className="group inline-flex items-baseline gap-1 hover:text-accent"
                    >
                      {item.text}
                      <span
                        aria-hidden
                        className="inline-block transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      >
                        ↗
                      </span>
                      {external && <span className="sr-only">(opens in a new tab)</span>}
                    </a>
                  ) : (
                    item.text
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {gallery.length > 0 && (
        <div className="mt-10">
          <Gallery photos={gallery} />
        </div>
      )}

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
