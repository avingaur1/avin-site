"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, Check, CircleAlert, ExternalLink, Eye, FileText, Images, Loader2, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ALLOWED_USER, IMAGES_DIR, LIVE_URL, PUBLIC_IMAGES, RAW, SITE_JSON } from "./config";
import * as gh from "./github";
import { GitHubError, type DeployState } from "./github";
import { clearDraft, loadDraft, saveDraft, type Draft, type PendingUpload } from "./draft";
import { optimise, slugName, uniqueName } from "./images";
import { readReturnFromSignIn, signOut, storedToken } from "./auth";
import { Ctx, describeChanges, problems, same, serialise, usedImages, withIds, type EditorCtx, type Toast } from "./state";
import { Button, Dialog } from "./ui";
import { SignIn } from "./SignIn";
import { WorkEditor } from "./sections/WorkEditor";
import { PhotosEditor } from "./sections/PhotosEditor";
import { ContentEditor } from "./sections/ContentEditor";
import { Preview } from "./Preview";

type Published = { data: any; sha: string; head: string };
type Tab = "work" | "photos" | "content";
type PublishState =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "working"; step: string }
  | { kind: "conflict"; head: string }
  | { kind: "error"; message: string }
  | { kind: "done"; sha: string; deploy: DeployState };

const TABS: { id: Tab; label: string; icon: typeof Briefcase }[] = [
  { id: "work", label: "Work", icon: Briefcase },
  { id: "photos", label: "Photos", icon: Images },
  { id: "content", label: "Website", icon: FileText },
];

export default function AdminApp() {
  const [phase, setPhase] = useState<"boot" | "signin" | "loading" | "ready">("boot");
  const [signInMsg, setSignInMsg] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [user, setUser] = useState<{ login: string; avatar_url: string } | null>(null);
  const [published, setPublished] = useState<Published | null>(null);
  const [data, setData] = useState<any>(null);
  const [uploads, setUploads] = useState<Map<string, PendingUpload & { url: string }>>(new Map());
  const [library, setLibrary] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("work");
  const [preview, setPreview] = useState(false);
  const [pub, setPub] = useState<PublishState>({ kind: "idle" });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [staleDraft, setStaleDraft] = useState<Draft | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ask, setAsk] = useState<{ title: string; body?: string; ok: string; danger?: boolean; resolve: (v: boolean) => void } | null>(null);
  const [blocked, setBlocked] = useState<string[] | null>(null);
  const sizes = useRef(new Map<string, { width: number; height: number }>());

  /* ------------------------------------------------------------ helpers */

  const toast = useCallback((text: string, kind?: Toast["kind"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 3500);
  }, []);

  const handleError = useCallback(
    (e: unknown) => {
      if (e instanceof GitHubError && e.status === 401) {
        signOut();
        setSignInMsg("Your sign-in has expired. Your changes are saved on this device — sign in again to carry on.");
        setPhase("signin");
        return true;
      }
      return false;
    },
    [],
  );

  /* -------------------------------------------------------------- load */

  const load = useCallback(
    async (tk: string) => {
      setPhase("loading");
      try {
        const me = await gh.getUser(tk);
        if (me.login.toLowerCase() !== ALLOWED_USER.toLowerCase()) {
          signOut();
          setSignInMsg(`You're signed in as ${me.login}. Only ${ALLOWED_USER} can edit this site.`);
          setPhase("signin");
          return;
        }
        if (!(await gh.canPublish(tk))) {
          signOut();
          setSignInMsg("This sign-in can read the site but isn't allowed to publish. Check the permissions in the setup guide.");
          setPhase("signin");
          return;
        }
        const head = await gh.getHead(tk);
        const [site, lib] = await Promise.all([gh.getSiteJson(tk, head), gh.listImages(tk, head)]);
        const pubd = { data: withIds(site.data), sha: site.sha, head };
        setToken(tk);
        setUser(me);
        setPublished(pubd);
        setLibrary(lib);

        const draft = await loadDraft();
        const hasDraft = draft && (!same(draft.data, site.data) || draft.uploads.length > 0);
        if (hasDraft && draft.baseSha === site.sha) {
          restore(draft);
          toast("Picked up your unpublished changes.");
        } else {
          setData(pubd.data);
          if (hasDraft && !same(draft.data, site.data)) setStaleDraft(draft);
        }
        setPhase("ready");
      } catch (e) {
        if (handleError(e)) return;
        signOut();
        setSignInMsg(
          e instanceof GitHubError && e.status === 403
            ? "GitHub refused access. Check the key's permissions in the setup guide."
            : `Couldn't reach GitHub (${(e as Error).message}). Check your connection and try again.`,
        );
        setPhase("signin");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleError, toast],
  );

  function restore(d: Draft) {
    const m = new Map<string, PendingUpload & { url: string }>();
    d.uploads.forEach((u) => {
      m.set(u.path, { ...u, url: URL.createObjectURL(u.blob) });
      sizes.current.set(u.path.replace(/^public/, ""), { width: u.width, height: u.height });
    });
    setUploads(m);
    setData(withIds(d.data));
  }

  useEffect(() => {
    const back = readReturnFromSignIn();
    if (back.error) {
      setSignInMsg(back.error);
      setPhase("signin");
      return;
    }
    const tk = back.token || storedToken();
    if (tk) load(tk);
    else setPhase("signin");
  }, [load]);

  /* ---------------------------------------------------------- autosave */

  const dirty = useMemo(() => !!(published && data && !same(published.data, data)), [published, data]);

  useEffect(() => {
    if (phase !== "ready" || !published || !data) return;
    const t = setTimeout(async () => {
      if (!dirty) {
        await clearDraft();
        setSavedAt(null);
        return;
      }
      const used = usedImages(data);
      const ups = [...uploads.values()]
        .filter((u) => used.has(u.path.replace(/^public/, "")))
        .map(({ url: _url, ...u }) => u);
      try {
        await saveDraft({ data: JSON.parse(serialise(data)), uploads: ups, baseSha: published.sha, savedAt: Date.now() });
        setSavedAt(Date.now());
      } catch {
        // Private browsing can block storage; the editor still works, it just can't keep drafts.
      }
    }, 500);
    return () => clearTimeout(t);
  }, [data, uploads, dirty, phase, published]);

  // Warn before leaving with unpublished changes that couldn't be stored.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty && !savedAt) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty, savedAt]);

  /* ----------------------------------------------------------- context */

  const update = useCallback((fn: (d: any) => void) => {
    setData((prev: any) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  const resolve = useCallback(
    (src?: string) => {
      if (!src) return "";
      if (/^(https?:|blob:|data:)/.test(src)) return src;
      const path = `public${src.startsWith("/") ? src : `/${src}`}`;
      const up = uploads.get(path);
      if (up) return up.url;
      return `${RAW}/${published?.head ?? "main"}/${path.split("/").map(encodeURIComponent).join("/")}`;
    },
    [uploads, published],
  );

  const addPhotos = useCallback(
    async (files: File[]) => {
      const out: { src: string; width: number; height: number }[] = [];
      const taken = new Set([...library.map((n) => n.toLowerCase()), ...[...uploads.keys()].map((p) => p.split("/").pop()!.toLowerCase())]);
      const added: [string, PendingUpload & { url: string }][] = [];
      for (const f of files) {
        // The same file picked twice (say, for the gallery and the portrait) is uploaded once.
        const key = `${f.name}|${f.size}|${f.lastModified}`;
        const dup = [...uploads.values(), ...added.map(([, u]) => u)].find((u) => u.key === key);
        if (dup) {
          out.push({ src: dup.path.replace(/^public/, ""), width: dup.width, height: dup.height });
          continue;
        }
        try {
          const o = await optimise(f);
          const name = uniqueName(slugName(f.name), o.ext, taken);
          taken.add(name);
          const path = `${IMAGES_DIR}/${name}`;
          const src = `${PUBLIC_IMAGES}/${name}`;
          added.push([path, { path, key, blob: o.blob, width: o.width, height: o.height, url: URL.createObjectURL(o.blob) }]);
          sizes.current.set(src, { width: o.width, height: o.height });
          out.push({ src, width: o.width, height: o.height });
        } catch (e) {
          toast(`${f.name}: ${(e as Error).message}`, "error");
        }
      }
      if (added.length) setUploads((m) => new Map([...m, ...added]));
      return out;
    },
    [library, uploads, toast],
  );

  const confirm = useCallback(
    (o: { title: string; body?: string; ok: string; danger?: boolean }) =>
      new Promise<boolean>((resolve) => setAsk({ ...o, resolve })),
    [],
  );

  const ctx: EditorCtx | null = data
    ? {
        data,
        update,
        resolve,
        addPhotos,
        isNew: (src) => !!src && uploads.has(`public${src}`),
        library,
        toast,
        confirm,
        sizeOf: (src) => (src ? sizes.current.get(src) : undefined),
      }
    : null;

  /* ----------------------------------------------------------- publish */

  const usedUploads = () => {
    const used = usedImages(data);
    return [...uploads.values()].filter((u) => used.has(u.path.replace(/^public/, "")));
  };

  const startPublish = () => {
    const p = problems(data);
    if (p.length) return setBlocked(p);
    setPub({ kind: "confirm" });
  };

  const publish = async (overwrite = false) => {
    if (!published) return;
    const ups = usedUploads();
    const changes = describeChanges(published.data, data, ups.length);
    try {
      setPub({ kind: "working", step: "Checking your site" });
      let head = await gh.getHead(token);
      if (head !== published.head && !overwrite) {
        const now = await gh.getSiteJson(token, head);
        if (now.sha !== published.sha) {
          setPub({ kind: "conflict", head });
          return;
        }
      }
      const files: gh.PublishFile[] = [
        ...ups.map((u) => ({ path: u.path, blob: u.blob })),
        { path: SITE_JSON, text: serialise(data) },
      ];
      const message = `Update ${changes.filter((c) => !/new photo/.test(c)).join(", ").toLowerCase() || "photos"} from the editor`;
      let sha: string;
      try {
        sha = await gh.commitFiles(token, head, files, message, (step) => setPub({ kind: "working", step }));
      } catch (e) {
        // Someone else's commit landed in the last few seconds: retry once on top of it.
        if (!(e instanceof GitHubError && e.status === 422)) throw e;
        head = await gh.getHead(token);
        const now = await gh.getSiteJson(token, head);
        if (now.sha !== published.sha && !overwrite) {
          setPub({ kind: "conflict", head });
          return;
        }
        sha = await gh.commitFiles(token, head, files, message, (step) => setPub({ kind: "working", step }));
      }

      const site = await gh.getSiteJson(token, sha);
      setPublished({ data, sha: site.sha, head: sha });
      setLibrary((l) => [...new Set([...l, ...ups.map((u) => u.path.split("/").pop()!)])]);
      setUploads(new Map());
      await clearDraft();
      setSavedAt(null);
      setStaleDraft(null);
      setPub({ kind: "done", sha, deploy: { kind: "waiting" } });
    } catch (e) {
      if (handleError(e)) return setPub({ kind: "idle" });
      setPub({ kind: "error", message: (e as Error).message });
    }
  };

  // Follow the deploy until the site is live.
  const doneSha = pub.kind === "done" ? pub.sha : null;
  useEffect(() => {
    if (!doneSha) return;
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop) return;
      let state: DeployState;
      try {
        state = await gh.deployStatus(token, doneSha);
      } catch {
        state = { kind: "building" };
      }
      if (stop) return;
      setPub((p) => (p.kind === "done" && p.sha === doneSha ? { ...p, deploy: state } : p));
      const finished = state.kind === "live" || state.kind === "failed" || state.kind === "unknown";
      if (!finished && Date.now() - started < 15 * 60_000) setTimeout(tick, 6000);
    };
    setTimeout(tick, 2500);
    return () => {
      stop = true;
    };
  }, [doneSha, token]);

  const discard = async () => {
    if (!published) return;
    const ok = await confirm({
      title: "Discard unpublished changes?",
      body: "Everything you've changed since your last publish will be undone.",
      ok: "Discard",
      danger: true,
    });
    if (!ok) return;
    setData(published.data);
    setUploads(new Map());
    await clearDraft();
    setSavedAt(null);
  };

  const reloadLatest = async () => {
    await clearDraft();
    setUploads(new Map());
    setPub({ kind: "idle" });
    load(token);
  };

  /* -------------------------------------------------------------- views */

  if (phase === "boot" || phase === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted" role="status">
        <Loader2 className="mr-2 animate-spin" size={18} aria-hidden /> {phase === "loading" ? "Loading your site…" : ""}
      </div>
    );
  }

  if (phase === "signin" || !ctx || !published) {
    return <SignIn message={signInMsg} onToken={(tk) => { setSignInMsg(""); load(tk); }} />;
  }

  const deploying = pub.kind === "done" && (pub.deploy.kind === "waiting" || pub.deploy.kind === "building");
  const nUploads = usedUploads().length;

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-dvh pb-28">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[920px] items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-semibold tracking-tight">avin.</span>
              <span className="text-[13px] text-muted">editor</span>
            </div>
            <nav aria-label="Sections" className="hidden items-center gap-1 rounded-full border border-line p-0.5 sm:flex">
              {TABS.map((t) => (
                <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />
              ))}
            </nav>
            <div className="flex items-center gap-1">
              <a
                href={LIVE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden h-8 items-center gap-1 rounded-full px-2.5 text-[13px] text-muted hover:text-fg sm:inline-flex"
              >
                View site <ExternalLink size={13} aria-hidden />
              </a>
              <ThemeToggle />
              <AccountMenu user={user} onSignOut={() => { signOut(); setSignInMsg("You're signed out. Unpublished changes stay on this device."); setPhase("signin"); }} />
            </div>
          </div>
          <nav aria-label="Sections" className="flex border-t border-line sm:hidden">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[14px] ${
                  tab === t.id ? "border-b-2 border-fg font-medium text-fg" : "border-b-2 border-transparent text-muted"
                }`}
              >
                <t.icon size={15} aria-hidden /> {t.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-[920px] px-4 pt-6 sm:px-6 sm:pt-10">
          {staleDraft && (
            <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-[14px]">
              <p className="font-medium">You have unpublished changes from {new Date(staleDraft.savedAt).toLocaleString()}.</p>
              <p className="mt-1 text-muted">Your site was changed somewhere else since then. Restoring them will replace those newer edits when you publish.</p>
              <div className="mt-3 flex gap-2">
                <Button small kind="primary" onClick={() => { restore(staleDraft); setStaleDraft(null); }}>Restore my changes</Button>
                <Button small onClick={async () => { await clearDraft(); setStaleDraft(null); }}>Discard them</Button>
              </div>
            </div>
          )}
          {tab === "work" && <WorkEditor />}
          {tab === "photos" && <PhotosEditor />}
          {tab === "content" && <ContentEditor />}
        </main>

        {/* Action bar */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto flex max-w-[920px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 text-[13px] leading-tight" aria-live="polite">
              {deploying ? (
                <span className="flex items-center gap-1.5 text-muted"><Loader2 size={14} className="animate-spin" aria-hidden /> Updating your live site…</span>
              ) : dirty ? (
                <>
                  <span className="block font-medium">Unpublished changes</span>
                  <span className="text-muted">
                    {savedAt ? "Draft saved on this device" : "Saving draft…"} ·{" "}
                    <button type="button" onClick={discard} className="underline-offset-2 hover:text-fg hover:underline">Discard</button>
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1.5 text-muted"><Check size={14} aria-hidden /> Everything is published</span>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button onClick={() => setPreview(true)}>
                <Eye size={16} aria-hidden /> Preview
              </Button>
              <Button kind="accent" onClick={startPublish} disabled={!dirty || pub.kind === "working"}>
                Publish
              </Button>
            </div>
          </div>
        </div>

        {/* Toasts */}
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto max-w-[480px] rounded-xl px-4 py-2.5 text-[14px] shadow-lg ${
                t.kind === "error" ? "bg-red-600 text-white" : "bg-fg text-bg"
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      </div>

      {preview && <Preview onClose={() => setPreview(false)} />}

      {/* Confirm */}
      <Dialog
        open={!!ask}
        onClose={() => { ask?.resolve(false); setAsk(null); }}
        title={ask?.title ?? ""}
        footer={
          <>
            <Button onClick={() => { ask?.resolve(false); setAsk(null); }}>Cancel</Button>
            <Button kind={ask?.danger ? "primary" : "accent"} className={ask?.danger ? "!bg-red-600 !text-white" : ""} onClick={() => { ask?.resolve(true); setAsk(null); }}>
              {ask?.ok}
            </Button>
          </>
        }
      >
        {ask?.body}
      </Dialog>

      {/* Nothing to publish yet */}
      <Dialog
        open={!!blocked}
        onClose={() => setBlocked(null)}
        title="A few things to fix first"
        footer={<Button kind="primary" onClick={() => setBlocked(null)}>OK</Button>}
      >
        <ul className="list-disc space-y-1 pl-5">{blocked?.map((b) => <li key={b}>{b}</li>)}</ul>
      </Dialog>

      {/* Publish flow */}
      <Dialog
        open={pub.kind !== "idle"}
        onClose={() => pub.kind !== "working" && setPub({ kind: "idle" })}
        title={
          pub.kind === "confirm" ? "Publish your changes?"
          : pub.kind === "working" ? "Publishing…"
          : pub.kind === "conflict" ? "Your site changed elsewhere"
          : pub.kind === "error" ? "Couldn't publish"
          : "Published"
        }
        wide
        footer={
          pub.kind === "confirm" ? (
            <>
              <Button onClick={() => setPub({ kind: "idle" })}>Not yet</Button>
              <Button kind="accent" onClick={() => publish()}>Publish now</Button>
            </>
          ) : pub.kind === "conflict" ? (
            <>
              <Button onClick={reloadLatest}>Discard mine, load latest</Button>
              <Button kind="accent" onClick={() => publish(true)}>Publish mine anyway</Button>
            </>
          ) : pub.kind === "error" ? (
            <>
              <Button onClick={() => setPub({ kind: "idle" })}>Close</Button>
              <Button kind="accent" onClick={() => publish()}>Try again</Button>
            </>
          ) : pub.kind === "done" ? (
            <Button kind="primary" onClick={() => setPub({ kind: "idle" })}>{deploying ? "Keep editing" : "Done"}</Button>
          ) : null
        }
      >
        {pub.kind === "confirm" && (
          <>
            <p>These will go live on your website:</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-fg">
              {describeChanges(published.data, data, nUploads).map((c) => <li key={c}>{c}</li>)}
            </ul>
            <p className="mt-3 text-[13px]">It takes about two minutes for the live site to update.</p>
          </>
        )}
        {pub.kind === "working" && (
          <p className="flex items-center gap-2" role="status"><Loader2 size={16} className="animate-spin" aria-hidden /> {pub.step}…</p>
        )}
        {pub.kind === "conflict" && (
          <p>Your site was changed somewhere else (another device or tab, or directly on GitHub) after you opened this editor. Publishing yours will replace those changes.</p>
        )}
        {pub.kind === "error" && (
          <p>{pub.message}. Your changes are still saved on this device.</p>
        )}
        {pub.kind === "done" && <DeploySteps deploy={pub.deploy} />}
      </Dialog>
    </Ctx.Provider>
  );
}

function TabButton({ t, active, onClick }: { t: (typeof TABS)[number]; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[14px] ${active ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
    >
      <t.icon size={14} aria-hidden /> {t.label}
    </button>
  );
}

function DeploySteps({ deploy }: { deploy: DeployState }) {
  const row = (state: "done" | "doing" | "todo" | "fail", text: React.ReactNode) => (
    <li className="flex items-center gap-2.5">
      <span className="inline-flex h-5 w-5 items-center justify-center">
        {state === "done" && <Check size={16} className="text-green-600 dark:text-green-400" aria-hidden />}
        {state === "doing" && <Loader2 size={15} className="animate-spin" aria-hidden />}
        {state === "todo" && <span className="h-2 w-2 rounded-full bg-line" />}
        {state === "fail" && <CircleAlert size={16} className="text-red-600" aria-hidden />}
      </span>
      <span className={state === "todo" ? "text-muted" : "text-fg"}>{text}</span>
    </li>
  );
  const k = deploy.kind;
  return (
    <div>
      <ul className="space-y-2">
        {row("done", "Saved to your site")}
        {k === "unknown"
          ? row("done", "Your live site will update in about two minutes")
          : k === "failed"
            ? row("fail", <>The update didn&apos;t finish. <a href={deploy.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">See what went wrong</a></>)
            : row(k === "live" ? "done" : "doing", k === "live" ? "Live site updated" : "Updating the live site (about two minutes)")}
      </ul>
      {(k === "live" || k === "unknown") && (
        <a href={LIVE_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-accent">
          Open your website <ExternalLink size={14} aria-hidden />
        </a>
      )}
      {(k === "waiting" || k === "building") && (
        <p className="mt-3 text-[13px]">You can close this and keep editing.</p>
      )}
    </div>
  );
}

function AccountMenu({ user, onSignOut }: { user: { login: string; avatar_url: string } | null; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        aria-expanded={open}
        className="ml-1 inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-line"
      >
        {user?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[12px]">A</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-56 rounded-xl border border-line bg-bg p-1.5 text-[14px] shadow-xl">
          <p className="px-3 py-2 text-[12.5px] text-muted">Signed in as {user?.login}</p>
          <a href={LIVE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-placeholder">
            <ExternalLink size={14} aria-hidden /> View live site
          </a>
          <button type="button" onClick={onSignOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-placeholder">
            <LogOut size={14} aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
