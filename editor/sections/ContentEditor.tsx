"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { newId, useEditor } from "../state";
import { Button, Card, Field, SectionTitle, SortableList, TextArea, TextInput, arrayMove, inputCls, tidyUrl } from "../ui";

export function ContentEditor() {
  const [open, setOpen] = useState<string | null>("intro");
  const panel = (id: string, title: string, sub: string, body: ReactNode) => (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(open === id ? null : id)}
        aria-expanded={open === id}
        className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{title}</span>
          <span className="block text-[13px] text-muted">{sub}</span>
        </span>
        <ChevronDown size={18} aria-hidden className={`shrink-0 text-muted transition-transform ${open === id ? "rotate-180" : ""}`} />
      </button>
      {open === id && <div className="space-y-5 border-t border-line px-4 py-5 sm:px-5">{body}</div>}
    </Card>
  );

  return (
    <div>
      <SectionTitle title="Website text" sub="Your homepage words, portrait and links." />
      <div className="space-y-2.5">
        {panel("intro", "Introduction", "Your name, portrait and opening lines", <IntroPanel />)}
        {panel("campus", "My Journey at Campus", "Clubs, roles and stories", <CampusPanel />)}
        {panel("beyond", "Beyond the Resume", "The text, interests and links (photos are in the Photos tab)", <BeyondPanel />)}
        {panel("connect", "Contact", "Email, social links and footer", <ConnectPanel />)}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function TextList({
  label,
  items,
  onChange,
  addLabel,
  firstHint,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  firstHint?: string;
}) {
  return (
    <div className="space-y-3">
      {items.map((t, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1">
            <TextArea
              label={items.length > 1 ? `${label} ${i + 1}` : label}
              hint={i === 0 ? firstHint : undefined}
              value={t}
              rows={2}
              onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))}
            />
          </div>
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              title="Remove"
              className="mt-7 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-red-600"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          )}
        </div>
      ))}
      <Button small onClick={() => onChange([...items, ""])}>
        <Plus size={14} aria-hidden /> {addLabel}
      </Button>
    </div>
  );
}

function PhotoPicker({
  label,
  src,
  onPick,
  onClear,
  hint,
  tall,
}: {
  label: string;
  src?: string;
  onPick: (src: string) => void;
  onClear?: () => void;
  hint?: string;
  tall?: boolean;
}) {
  const { resolve, addPhotos, isNew } = useEditor();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const [a] = await addPhotos([f]);
      if (a) onPick(a.src);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-4">
        <div
          className={`relative shrink-0 overflow-hidden rounded-lg border border-line bg-placeholder ${
            tall ? "aspect-[3/4] w-24" : "aspect-[4/3] w-28"
          }`}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolve(src)} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-muted">
              <ImagePlus size={20} strokeWidth={1.5} aria-hidden />
            </span>
          )}
          {isNew(src) && (
            <span className="absolute left-1 top-1 rounded-full bg-accent px-1.5 text-[10px] font-medium text-bg">New</span>
          )}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <Button small busy={busy} onClick={() => input.current?.click()}>
            {src ? "Replace photo" : "Add photo"}
          </Button>
          {src && onClear && (
            <Button small kind="ghost" onClick={onClear} className="-ml-3">
              Remove
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </Field>
  );
}

function DeleteRow({ onDelete, label }: { onDelete: () => void; label: string }) {
  return (
    <Button kind="danger" small onClick={onDelete} className="-ml-3">
      <Trash2 size={15} aria-hidden /> {label}
    </Button>
  );
}

/* ---------------------------------------------------------------- panels */

function IntroPanel() {
  const { data, update } = useEditor();
  const intro = data.intro ?? {};
  const lines: string[] = intro.lines?.length ? intro.lines : [""];
  return (
    <>
      <TextInput label="Your name" value={intro.heading ?? ""} onChange={(v) => update((d) => ((d.intro ??= {}).heading = v))} />
      <PhotoPicker
        label="Portrait"
        tall
        src={intro.portrait?.src}
        hint="A portrait-shaped (3:4) photo works best."
        onPick={(src) => update((d) => (((d.intro ??= {}).portrait ??= { alt: "Avin Gaur" }).src = src))}
        onClear={() => update((d) => (d.intro.portrait.src = ""))}
      />
      <TextList
        label="Paragraph"
        firstHint="The first paragraph is shown larger."
        items={lines}
        addLabel="Add paragraph"
        onChange={(next) => update((d) => ((d.intro ??= {}).lines = next))}
      />
    </>
  );
}

function CampusPanel() {
  const { data, update, confirm } = useEditor();
  const c = data.campus ?? {};
  const entries: any[] = c.entries ?? [];
  const [open, setOpen] = useState<string | null>(null);

  const add = () => {
    const id = newId();
    update((d) => {
      d.campus ??= {};
      (d.campus.entries ??= []).push({ __id: id, title: "", href: "", paragraphs: [""], photos: [] });
    });
    setOpen(id);
  };

  return (
    <>
      <TextInput label="Section heading" value={c.heading ?? ""} onChange={(v) => update((d) => ((d.campus ??= {}).heading = v))} />
      <TextArea label="Introduction" value={c.intro ?? ""} onChange={(v) => update((d) => ((d.campus ??= {}).intro = v))} />

      <div>
        <p className="mb-2 text-[13px] font-medium">Experiences</p>
        <SortableList
          items={entries}
          className="space-y-2"
          onReorder={(a, b) => update((d) => (d.campus.entries = arrayMove(d.campus.entries, a, b)))}
          render={(e, i, handle) => {
            const isOpen = open === e.__id;
            const paras: string[] = e.paragraphs?.length ? e.paragraphs : [""];
            const photos: any[] = e.photos ?? [];
            return (
              <div className="rounded-lg border border-line">
                <div className="flex items-center gap-1 py-1.5 pl-1 pr-2">
                  {handle}
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : e.__id)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{e.title || <span className="text-muted">New experience</span>}</span>
                    <ChevronDown size={17} aria-hidden className={`text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {isOpen && (
                  <div className="space-y-4 border-t border-line p-4">
                    <TextInput
                      label="Title"
                      value={e.title ?? ""}
                      autoFocus={!e.title}
                      onChange={(v) => update((d) => (d.campus.entries[i].title = v))}
                    />
                    <TextInput
                      label="Website"
                      type="url"
                      inputMode="url"
                      placeholder="https://"
                      hint="Optional. Makes the title a link."
                      value={e.href ?? ""}
                      onChange={(v) => update((d) => (d.campus.entries[i].href = v))}
                      onBlur={() => update((d) => (d.campus.entries[i].href = tidyUrl(d.campus.entries[i].href)))}
                    />
                    <TextList
                      label="Paragraph"
                      items={paras}
                      addLabel="Add paragraph"
                      onChange={(next) => update((d) => (d.campus.entries[i].paragraphs = next))}
                    />
                    <div className="space-y-3">
                      <p className="text-[13px] font-medium">Photos <span className="font-normal text-muted">(up to 3)</span></p>
                      {photos.map((p, k) => (
                        <div key={p.__id ?? k} className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            <PhotoPicker
                              label={`Photo ${k + 1}`}
                              src={p.src}
                              onPick={(src) => update((d) => (d.campus.entries[i].photos[k].src = src))}
                            />
                            <input
                              className={inputCls}
                              placeholder="Describe the photo"
                              aria-label={`Photo ${k + 1} description`}
                              value={p.alt ?? ""}
                              onChange={(ev) => update((d) => (d.campus.entries[i].photos[k].alt = ev.target.value))}
                            />
                            <input
                              className={inputCls}
                              placeholder="Caption (optional)"
                              aria-label={`Photo ${k + 1} caption`}
                              value={p.caption ?? ""}
                              onChange={(ev) => update((d) => (d.campus.entries[i].photos[k].caption = ev.target.value))}
                            />
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove photo ${k + 1}`}
                            onClick={() => update((d) => d.campus.entries[i].photos.splice(k, 1))}
                            className="mt-6 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-red-600"
                          >
                            <X size={16} aria-hidden />
                          </button>
                        </div>
                      ))}
                      {photos.length < 3 && (
                        <Button
                          small
                          onClick={() =>
                            update((d) => (d.campus.entries[i].photos ??= []).push({ __id: newId(), src: "", alt: "", caption: "" }))
                          }
                        >
                          <Plus size={14} aria-hidden /> Add photo slot
                        </Button>
                      )}
                    </div>
                    <div className="flex justify-between pt-1">
                      <DeleteRow
                        label="Delete"
                        onDelete={async () => {
                          if (
                            await confirm({
                              title: `Delete ${e.title || "this experience"}?`,
                              body: "It will be removed from your site the next time you publish.",
                              ok: "Delete",
                              danger: true,
                            })
                          )
                            update((d) => d.campus.entries.splice(i, 1));
                        }}
                      />
                      <Button small onClick={() => setOpen(null)}>Done</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          }}
        />
        <Button small className="mt-3" onClick={add}>
          <Plus size={14} aria-hidden /> Add experience
        </Button>
      </div>
    </>
  );
}

function BeyondPanel() {
  const { data, update } = useEditor();
  const b = data.beyond ?? {};
  const items: any[] = b.items ?? [];
  return (
    <>
      <TextInput label="Section heading" value={b.heading ?? ""} onChange={(v) => update((d) => ((d.beyond ??= {}).heading = v))} />
      <TextArea label="Text" value={b.description ?? ""} rows={3} onChange={(v) => update((d) => ((d.beyond ??= {}).description = v))} />

      <div>
        <p className="mb-1 text-[13px] font-medium">Interests</p>
        <p className="mb-3 text-[12.5px] text-muted">Short rows like “Music · What I've been listening to”. Rows with no text are hidden.</p>
        <SortableList
          items={items}
          className="space-y-2"
          onReorder={(a, c) => update((d) => (d.beyond.items = arrayMove(d.beyond.items, a, c)))}
          render={(it, i, handle) => (
            <div className="flex items-start gap-1 rounded-lg border border-line p-2 pl-1">
              <div className="pt-0.5">{handle}</div>
              <div className="grid flex-1 gap-2 sm:grid-cols-3">
                <input className={inputCls} aria-label="Label" placeholder="Label, e.g. Music" value={it.label ?? ""} onChange={(e) => update((d) => (d.beyond.items[i].label = e.target.value))} />
                <input className={inputCls} aria-label="Text" placeholder="Text" value={it.text ?? ""} onChange={(e) => update((d) => (d.beyond.items[i].text = e.target.value))} />
                <input
                  className={inputCls}
                  aria-label="Link"
                  placeholder="Link (optional)"
                  inputMode="url"
                  autoCapitalize="off"
                  value={it.href ?? ""}
                  onChange={(e) => update((d) => (d.beyond.items[i].href = e.target.value))}
                  onBlur={() => update((d) => (d.beyond.items[i].href = tidyUrl(d.beyond.items[i].href)))}
                />
              </div>
              <button
                type="button"
                aria-label="Remove interest"
                onClick={() => update((d) => d.beyond.items.splice(i, 1))}
                className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-red-600"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          )}
        />
        <Button small className="mt-3" onClick={() => update((d) => ((d.beyond ??= {}).items ??= []).push({ __id: newId(), label: "", text: "", href: "" }))}>
          <Plus size={14} aria-hidden /> Add interest
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Interactive resume: link text"
          value={b.interactiveResume?.label ?? ""}
          onChange={(v) => update((d) => (((d.beyond ??= {}).interactiveResume ??= {}).label = v))}
        />
        <TextInput
          label="Interactive resume: address"
          type="url"
          inputMode="url"
          placeholder="https://"
          hint="Hidden on the site while empty."
          value={b.interactiveResume?.href ?? ""}
          onChange={(v) => update((d) => (((d.beyond ??= {}).interactiveResume ??= {}).href = v))}
          onBlur={() => update((d) => d.beyond?.interactiveResume && (d.beyond.interactiveResume.href = tidyUrl(d.beyond.interactiveResume.href)))}
        />
      </div>
    </>
  );
}

function ConnectPanel() {
  const { data, update } = useEditor();
  const c = data.connect ?? {};
  const links: any[] = c.links ?? [];
  return (
    <>
      <TextInput label="Section heading" value={c.heading ?? ""} onChange={(v) => update((d) => ((d.connect ??= {}).heading = v))} />
      <TextArea label="Text" value={c.text ?? ""} onChange={(v) => update((d) => ((d.connect ??= {}).text = v))} />

      <div>
        <p className="mb-1 text-[13px] font-medium">Links</p>
        <p className="mb-3 text-[12.5px] text-muted">For email, just type the address. Links with no address are hidden.</p>
        <SortableList
          items={links}
          className="space-y-2"
          onReorder={(a, b) => update((d) => (d.connect.links = arrayMove(d.connect.links, a, b)))}
          render={(l, i, handle) => (
            <div className="flex items-start gap-1 rounded-lg border border-line p-2 pl-1">
              <div className="pt-0.5">{handle}</div>
              <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_2fr]">
                <input className={inputCls} aria-label="Label" placeholder="Label, e.g. LinkedIn" value={l.label ?? ""} onChange={(e) => update((d) => (d.connect.links[i].label = e.target.value))} />
                <input
                  className={inputCls}
                  aria-label={`${l.label || "Link"} address`}
                  placeholder="Address or email"
                  inputMode="url"
                  autoCapitalize="off"
                  value={(l.href ?? "").replace(/^mailto:/, "")}
                  onChange={(e) => update((d) => (d.connect.links[i].href = e.target.value))}
                  onBlur={() => update((d) => (d.connect.links[i].href = tidyUrl(d.connect.links[i].href)))}
                />
              </div>
              <button
                type="button"
                aria-label="Remove link"
                onClick={() => update((d) => d.connect.links.splice(i, 1))}
                className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-red-600"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          )}
        />
        <Button small className="mt-3" onClick={() => update((d) => ((d.connect ??= {}).links ??= []).push({ __id: newId(), label: "", href: "" }))}>
          <Plus size={14} aria-hidden /> Add link
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Footer text" value={data.footer?.left ?? ""} onChange={(v) => update((d) => ((d.footer ??= {}).left = v))} />
        <TextInput
          label="Footer, right side"
          hint="Optional."
          value={data.footer?.right ?? ""}
          onChange={(v) => update((d) => ((d.footer ??= {}).right = v))}
        />
      </div>
    </>
  );
}

