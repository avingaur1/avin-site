"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type GalleryPhoto = {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Horizontal photo gallery.
 * - Every photo keeps its own shape (fixed height, natural width), so nothing is cropped.
 * - Trackpad and touch scroll natively; a vertical mouse wheel over the strip scrolls it sideways
 *   until an end is reached, then the page carries on scrolling.
 * - Small arrows on desktop; clicking a photo opens it larger with previous/next.
 */
export function Gallery({ photos }: { photos: GalleryPhoto[] }) {
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [open, setOpen] = useState<number | null>(null);

  const updateEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft >= max - 1 });
  }, []);

  // Track whether there is more to scroll in each direction.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    // Images settle their width as they load.
    el.querySelectorAll("img").forEach((img) => img.addEventListener("load", updateEdges));
    return () => {
      el.removeEventListener("scroll", updateEdges);
      ro.disconnect();
    };
  }, [updateEdges, photos.length]);

  // Smooth wheel animation state, shared so the arrows can cancel it.
  const wheelTarget = useRef<number | null>(null);
  const wheelRaf = useRef(0);
  const stopWheel = () => {
    cancelAnimationFrame(wheelRaf.current);
    wheelRaf.current = 0;
    wheelTarget.current = null;
  };

  // Vertical mouse wheel → smooth sideways scroll while the strip can still move.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    const step = () => {
      const target = wheelTarget.current;
      if (target === null) return;
      const diff = target - el.scrollLeft;
      // Ease toward the target, at least 1px per frame so it never stalls on sub-pixel rounding.
      const move = Math.sign(diff) * Math.max(1, Math.abs(diff) * 0.22);
      if (Math.abs(diff) <= 1) {
        el.scrollLeft = target;
        stopWheel();
        return;
      }
      const before = el.scrollLeft;
      el.scrollLeft = before + move;
      if (el.scrollLeft === before) {
        // Couldn't move (already at an edge): finish here.
        stopWheel();
        updateEdges();
        return;
      }
      wheelRaf.current = requestAnimationFrame(step);
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // horizontal trackpad swipe: native
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const from = wheelTarget.current ?? el.scrollLeft;
      if ((delta < 0 && from <= 1) || (delta > 0 && from >= max - 1)) return; // let the page scroll
      e.preventDefault();
      const next = Math.max(0, Math.min(max, from + delta));
      if (prefersReducedMotion()) {
        el.scrollLeft = next;
        return;
      }
      wheelTarget.current = next;
      if (!wheelRaf.current) wheelRaf.current = requestAnimationFrame(step);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    // A touch or a drag on the scrollbar takes over from any wheel animation.
    el.addEventListener("pointerdown", stopWheel);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", stopWheel);
      stopWheel();
    };
  }, [updateEdges]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    stopWheel();
    el.scrollBy({
      left: dir * el.clientWidth * 0.8,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  if (photos.length === 0) return null;
  const scrollable = !(edges.start && edges.end);

  return (
    <div>
      <ul
        ref={scroller}
        aria-label="Photos"
        className="-mx-5 flex gap-3 overflow-x-auto overscroll-x-contain px-5 [scrollbar-width:none] md:mx-0 md:px-0 pointer-coarse:snap-x pointer-coarse:snap-mandatory pointer-coarse:scroll-px-5 md:pointer-coarse:scroll-px-0 [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((p, i) => (
          <li key={p.src + i} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open photo ${i + 1} of ${photos.length}${p.alt ? `: ${p.alt}` : ""}`}
              className="block cursor-zoom-in overflow-hidden rounded-[4px] bg-placeholder"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                alt={p.alt}
                width={p.width}
                height={p.height}
                loading={i < 3 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
                className="block h-[200px] w-auto max-w-none transition-opacity duration-200 hover:opacity-90 sm:h-[280px]"
              />
            </button>
          </li>
        ))}
      </ul>

      {scrollable && (
        <div className="mt-3 hidden justify-end gap-1 sm:flex">
          <button
            type="button"
            onClick={() => page(-1)}
            disabled={edges.start}
            aria-label="Scroll photos left"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-fg disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => page(1)}
            disabled={edges.end}
            aria-label="Scroll photos right"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-fg disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      )}

      {open !== null && (
        <Lightbox photos={photos} index={open} onChange={setOpen} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function Lightbox({
  photos,
  index,
  onChange,
  onClose,
}: {
  photos: GalleryPhoto[];
  index: number;
  onChange: (i: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const p = photos[index];
  const many = photos.length > 1;
  const go = useCallback(
    (dir: 1 | -1) => onChange((index + dir + photos.length) % photos.length),
    [index, onChange, photos.length],
  );

  // Open as a modal (focus trap + Esc for free) and stop the page behind from scrolling.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const opener = document.activeElement as HTMLElement | null;
    d.showModal();
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!many) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, many]);

  // Preload neighbours so next/previous feel instant.
  useEffect(() => {
    if (!many) return;
    [1, -1].forEach((d) => {
      const img = new Image();
      img.src = photos[(index + d + photos.length) % photos.length].src;
    });
  }, [index, many, photos]);

  const label = p.caption || p.alt;

  return (
    <dialog
      ref={dialog}
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.backdrop) onClose();
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null || !many) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
      className="theme-fade fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-bg/95 p-0 text-fg backdrop:bg-transparent"
    >
      <div data-backdrop="1" className="flex h-full w-full flex-col items-center justify-center px-4 pb-6 pt-14 sm:px-16">
        <figure data-backdrop="1" className="flex min-h-0 flex-1 flex-col items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={p.src}
            src={p.src}
            alt={p.alt}
            className="block max-h-[calc(100dvh-9rem)] max-w-full rounded-[4px] object-contain"
          />
          <figcaption className="mt-3 text-center text-[13px] text-muted">
            {label && <span>{label}</span>}
            {label && many && <span aria-hidden> · </span>}
            {many && (
              <span className="tabular-nums">
                {index + 1} / {photos.length}
              </span>
            )}
          </figcaption>
        </figure>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-fg"
      >
        <X size={20} strokeWidth={1.75} aria-hidden />
      </button>

      {many && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="absolute left-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-fg sm:left-3"
          >
            <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next photo"
            className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-fg sm:right-3"
          >
            <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
          </button>
        </>
      )}
    </dialog>
  );
}
