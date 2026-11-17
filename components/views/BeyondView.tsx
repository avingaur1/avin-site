import type { BeyondItem } from "@/content/site";
import { Section } from "../Section";
import { Gallery, type GalleryPhoto } from "../Gallery";
import { NowPlaying } from "../NowPlaying";
import { NOW_PLAYING_URL } from "@/lib/nowPlaying";

/** The Music row gets the live Spotify card above its link. */
const isMusic = (item: BeyondItem) =>
  item.label?.trim().toLowerCase() === "music" || !!item.href?.includes("spotify.com");

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
  const musicIndex = NOW_PLAYING_URL ? visible.findIndex(isMusic) : -1;
  return (
    <Section id="beyond" heading={heading}>
      <p className="-mt-2 max-w-[640px]">{description}</p>

      {/* Only rows with text are shown, so empty ones never look unfinished. */}
      {visible.length > 0 && (
        <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {visible.map((item, index) => {
            const external = item.href?.startsWith("http");
            return (
              // The Music row spans both columns so the Spotify strip lines up with the gallery below.
              <div key={item.label} className={index === musicIndex ? "sm:col-span-2" : undefined}>
                <dt className="text-[14px] font-medium">{item.label}</dt>
                {index === musicIndex && (
                  <dd className="mb-2 mt-1.5 min-w-0">
                    <NowPlaying playlistHref={item.href} />
                  </dd>
                )}
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
