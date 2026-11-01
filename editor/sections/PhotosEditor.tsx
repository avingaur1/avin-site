"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, X } from "lucide-react";
import { Gallery } from "@/components/Gallery";
import { PUBLIC_IMAGES } from "../config";
import { newId, useEditor, usedImages } from "../state";
import { Card, SectionTitle, SortableList, arrayMove, inputCls } from "../ui";

export function PhotosEditor() {
  const { data, update, resolve, addPhotos, isNew, library, confirm, sizeOf } = useEditor();
  const photos: any[] = data.beyond?.photos ?? [];
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!imgs.length) return;
    setBusy((b) => b + imgs.length);
    try {
      const added = await addPhotos(imgs);
      if (added.length)
        update((d) => {
          d.beyond ??= {};
          d.beyond.photos ??= [];
          d.beyond.photos.push(...added.map((a) => ({ __id: newId(), src: a.src, alt: "", caption: "" })));
        });
    } finally {
      setBusy((b) => b - imgs.length);
    }
  };

  const remove = async (i: number) => {
    const ok = await confirm({
      title: "Remove this photo from the gallery?",
      body: "The file itself is kept, so you can add it back later from “Other photos”.",
      ok: "Remove",
      danger: true,
    });
    if (ok) update((d) => d.beyond.photos.splice(i, 1));
  };

  // Photos already in the site folder that aren't used anywhere.
  const used = usedImages(data);
  const spare = library.map((n) => `${PUBLIC_IMAGES}/${n}`).filter((src) => !used.has(src));

  const preview = photos
    .filter((p) => p.src)
    .map((p) => ({ src: resolve(p.src), alt: p.alt ?? "", caption: p.caption, ...sizeOf(p.src) }));

  return (
    <div>
      <SectionTitle title="Photo gallery" sub="Shown in Beyond the Resume. Drag to change the order." />

      {/* Upload area */}
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload([...e.dataTransfer.files]);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors ${
          over ? "border-accent bg-accent/5" : "border-line"
        }`}
      >
        <ImagePlus size={28} strokeWidth={1.5} className="text-muted" aria-hidden />
        <div>
          <p className="font-medium">
            <span className="hidden sm:inline">Drop photos here, or </span>
            <button type="button" onClick={() => input.current?.click()} className="text-accent underline-offset-4 hover:underline">
              <span className="sm:hidden">Choose photos</span>
              <span className="hidden sm:inline">choose from your computer</span>
            </button>
          </p>
          <p className="mt-1 text-[13px] text-muted">You can pick several at once. They're resized automatically so the site stays fast.</p>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => {
            upload([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        {busy > 0 && (
          <p className="flex items-center gap-2 text-[13px] text-muted" role="status">
            <Loader2 size={14} className="animate-spin" aria-hidden /> Preparing {busy} photo{busy > 1 ? "s" : ""}…
          </p>
        )}
      </div>

      {/* Gallery grid */}
      {photos.length > 0 ? (
        <SortableList
          items={photos}
          grid
          className="mt-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3"
          onReorder={(a, b) => update((d) => (d.beyond.photos = arrayMove(d.beyond.photos, a, b)))}
          render={(p, i, handle) => (
            <Card className="flex h-full flex-col overflow-hidden">
              <div className="relative aspect-[4/3] bg-placeholder">
                {p.src && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolve(p.src)} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                )}
                <div className="absolute inset-x-0 top-0 flex items-start justify-between p-1.5">
                  <span className="rounded-md bg-bg/90 backdrop-blur">{handle}</span>
                  <span className="flex items-center gap-1.5">
                    {isNew(p.src) && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-bg">New</span>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label="Remove from gallery"
                      title="Remove from gallery"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-bg/90 text-fg backdrop-blur hover:text-red-600"
                    >
                      <X size={16} aria-hidden />
                    </button>
                  </span>
                </div>
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-bg/90 px-2 py-0.5 text-[11px] tabular-nums text-muted backdrop-blur">
                  {i + 1}
                </span>
              </div>
              <div className="space-y-2 p-3">
                <input
                  value={p.caption ?? ""}
                  onChange={(e) => update((d) => (d.beyond.photos[i].caption = e.target.value))}
                  placeholder="Caption (optional)"
                  aria-label="Caption"
                  className={`${inputCls} py-2 text-[15px]`}
                />
                <input
                  value={p.alt ?? ""}
                  onChange={(e) => update((d) => (d.beyond.photos[i].alt = e.target.value))}
                  placeholder="Describe the photo, e.g. Amber Palace, Jaipur"
                  aria-label="Description for screen readers (alt text)"
                  className={`${inputCls} py-2 text-[15px]`}
                />
              </div>
            </Card>
          )}
        />
      ) : (
        <Card className="mt-6 p-8 text-center text-muted">No photos in the gallery yet.</Card>
      )}

      <p className="mt-3 text-[12.5px] text-muted">
        The description is read aloud by screen readers and helps search engines. The caption shows when a photo is opened.
      </p>

      {/* Live-style preview */}
      {preview.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-1 text-[15px] font-semibold">How it looks on your site</h3>
          <p className="mb-4 text-[13px] text-muted">Scroll sideways, or click a photo to open it.</p>
          <div className="rounded-xl border border-line p-4 sm:p-5">
            <Gallery photos={preview} />
          </div>
        </div>
      )}

      {/* Spare photos */}
      {spare.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-1 text-[15px] font-semibold">Other photos</h3>
          <p className="mb-4 text-[13px] text-muted">Already uploaded to your site but not shown anywhere. Tap to add one back to the gallery.</p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {spare.map((src) => (
              <li key={src}>
                <button
                  type="button"
                  onClick={() =>
                    update((d) => {
                      d.beyond ??= {};
                      d.beyond.photos ??= [];
                      d.beyond.photos.push({ __id: newId(), src, alt: "", caption: "" });
                    })
                  }
                  className="group relative block aspect-square w-full overflow-hidden rounded-lg bg-placeholder"
                  aria-label={`Add ${src.split("/").pop()} to the gallery`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolve(src)} alt="" loading="lazy" className="h-full w-full object-cover transition-opacity group-hover:opacity-70" />
                  <span className="absolute bottom-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-bg/90 text-fg">
                    <Plus size={15} aria-hidden />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
