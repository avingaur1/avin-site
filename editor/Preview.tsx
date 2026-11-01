"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { IntroView } from "@/components/views/IntroView";
import { BeyondView } from "@/components/views/BeyondView";
import { WorkView } from "@/components/Work";
import { CampusView } from "@/components/Campus";
import { ConnectView } from "@/components/Connect";
import { Divider } from "@/components/Section";
import { useEditor } from "./state";

/**
 * The homepage drawn with the site's own components and your unpublished changes.
 * (Thoughts is left out: it comes from Medium and isn't edited here.)
 */
export function Preview({ onClose }: { onClose: () => void }) {
  const { data, resolve, sizeOf } = useEditor();

  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const intro = data.intro ?? {};
  const portrait = intro.portrait?.src
    ? {
        src: resolve(intro.portrait.src),
        alt: intro.portrait.alt || "Avin Gaur",
        width: sizeOf(intro.portrait.src)?.width ?? 600,
        height: sizeOf(intro.portrait.src)?.height ?? 800,
      }
    : null;
  const b = data.beyond ?? {};
  const fixPhotos = (ps: any[] = []) => ps.map((p) => ({ ...p, src: p.src ? resolve(p.src) : "" }));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-label="Preview of your homepage">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-3 sm:px-5">
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] font-medium hover:text-accent">
          <ArrowLeft size={16} aria-hidden /> Back to editing
        </button>
        <span className="hidden text-[13px] text-muted sm:block">Preview · not published yet</span>
        <span className="w-[120px]" aria-hidden />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div>
          <main className="mx-auto max-w-[780px] px-5 md:px-6">
            <IntroView heading={intro.heading || "Avin Gaur"} lines={intro.lines ?? []} photo={portrait} />
            <Divider />
            <WorkView heading={data.work?.heading || "Work"} subheading={data.work?.subheading ?? ""} entries={data.work?.entries ?? []} />
            <Divider />
            <CampusView
              heading={data.campus?.heading || "My Journey at Campus"}
              intro={data.campus?.intro ?? ""}
              entries={(data.campus?.entries ?? []).map((e: any) => ({ ...e, photos: fixPhotos(e.photos) }))}
            />
            <Divider />
            <section className="py-12 text-[14px] text-muted md:py-14">
              <p className="font-medium text-fg">{data.thoughts?.heading || "Thoughts"}</p>
              <p className="mt-1">Your Medium articles appear here automatically.</p>
            </section>
            <Divider />
            <BeyondView
              heading={b.heading || "Beyond the Resume"}
              description={b.description ?? ""}
              items={b.items ?? []}
              gallery={(b.photos ?? [])
                .filter((p: any) => p.src)
                .map((p: any) => ({ src: resolve(p.src), alt: p.alt ?? "", caption: p.caption, ...sizeOf(p.src) }))}
              interactiveResume={{ label: b.interactiveResume?.label || "Explore my interactive resume", href: b.interactiveResume?.href ?? "" }}
            />
            <Divider />
            <ConnectView heading={data.connect?.heading || "Let's Connect"} text={data.connect?.text ?? ""} links={data.connect?.links ?? []} />
          </main>
          <footer className="mx-auto max-w-[780px] px-5 md:px-6">
            <div className="flex items-center justify-between border-t border-line py-8 text-[13px] text-muted">
              <span>{data.footer?.left ?? ""}</span>
              {data.footer?.right && <span>{data.footer.right}</span>}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
