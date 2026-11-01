"use client";

import { createContext, useContext } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * List items get a temporary __id while in the editor so drag-and-drop and open/closed
 * panels can follow them. It's stripped before anything is published.
 */
let counter = 0;
export const newId = () => `i${Date.now().toString(36)}${(counter++).toString(36)}`;

export function withIds<T>(v: T): T {
  if (Array.isArray(v)) {
    return v.map((x) =>
      x && typeof x === "object" && !Array.isArray(x) ? { ...withIds(x), __id: x.__id || newId() } : withIds(x),
    ) as T;
  }
  if (v && typeof v === "object") {
    const o: any = {};
    for (const [k, x] of Object.entries(v)) o[k] = withIds(x);
    return o;
  }
  return v;
}

/** The exact text written to content/site.json (2-space JSON, like before). */
export function serialise(data: any) {
  return JSON.stringify(data, (k, v) => (k === "__id" ? undefined : v), 2) + "\n";
}

export function same(a: any, b: any) {
  return serialise(a) === serialise(b);
}

/** Plain-English list of what's about to be published. */
export function describeChanges(published: any, draft: any, newPhotos: number): string[] {
  const out: string[] = [];
  const s = (x: any) => serialise(x ?? null);
  if (s(published.intro) !== s(draft.intro)) out.push("Homepage introduction");
  if (s(published.work) !== s(draft.work)) out.push("Work experience");
  if (s(published.campus) !== s(draft.campus)) out.push("Campus experiences");
  const { photos: p0, ...b0 } = published.beyond ?? {};
  const { photos: p1, ...b1 } = draft.beyond ?? {};
  if (s(p0) !== s(p1)) out.push("Photo gallery");
  if (s(b0) !== s(b1)) out.push("Beyond the Resume");
  if (s(published.connect) !== s(draft.connect) || s(published.footer) !== s(draft.footer))
    out.push("Contact details");
  const known = ["intro", "work", "campus", "beyond", "connect", "footer"];
  const other = Object.keys({ ...published, ...draft }).filter((k) => !known.includes(k));
  if (other.some((k) => s(published[k]) !== s(draft[k]))) out.push("Other settings");
  if (newPhotos) out.push(`${newPhotos} new photo${newPhotos > 1 ? "s" : ""}`);
  return out;
}

/** Every photo path the site uses, so unused uploads aren't published. */
export function usedImages(data: any): Set<string> {
  const used = new Set<string>();
  const add = (src?: string) => src && used.add(src);
  add(data.intro?.portrait?.src);
  (data.beyond?.photos ?? []).forEach((p: any) => add(p.src));
  (data.campus?.entries ?? []).forEach((e: any) => (e.photos ?? []).forEach((p: any) => add(p.src)));
  return used;
}

/** Things that would look broken on the site. */
export function problems(data: any): string[] {
  const out: string[] = [];
  (data.work?.entries ?? []).forEach((e: any, i: number) => {
    if (!e.title?.trim()) out.push(`Work experience #${i + 1} needs a company name.`);
  });
  (data.campus?.entries ?? []).forEach((e: any, i: number) => {
    if (!e.title?.trim()) out.push(`Campus experience #${i + 1} needs a title.`);
  });
  if (!data.intro?.heading?.trim()) out.push("The homepage needs your name.");
  return out;
}

export type Toast = { id: number; text: string; kind?: "error" | "ok" };

export type EditorCtx = {
  data: any;
  update: (fn: (d: any) => void) => void;
  /** URL to show a site photo path (e.g. /images/x.webp) inside the editor. */
  resolve: (src?: string) => string;
  /** Optimise and stage photos; returns their site paths. */
  addPhotos: (files: File[]) => Promise<{ src: string; width: number; height: number }[]>;
  isNew: (src?: string) => boolean;
  library: string[];
  toast: (text: string, kind?: Toast["kind"]) => void;
  confirm: (o: { title: string; body?: string; ok: string; danger?: boolean }) => Promise<boolean>;
  sizeOf: (src?: string) => { width: number; height: number } | undefined;
};

export const Ctx = createContext<EditorCtx | null>(null);
export function useEditor() {
  const c = useContext(Ctx);
  if (!c) throw new Error("Editor context missing");
  return c;
}
