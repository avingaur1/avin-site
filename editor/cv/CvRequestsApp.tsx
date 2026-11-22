"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, LogOut, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CV_API_URL, cvFetch, type ApiError } from "@/lib/cvApi";
import { BASE_PATH } from "../config";
import { readReturnFromSignIn, signOut, storedToken } from "../auth";
import { SignIn } from "../SignIn";
import { Button } from "../ui";

/**
 * /admin/cv-requests/ : confirm decisions from the email, and see every request.
 *
 * The Approve / Reject buttons in the notification email land here with ?id=…&action=….
 * Opening the page changes nothing (so link scanners in mail apps can't approve anything):
 * the decision is only sent when you press Confirm, signed in with the same GitHub sign-in as
 * the editor. The Worker re-checks that sign-in with GitHub on every change.
 */

type Req = {
  id: string;
  fullName: string;
  email: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt: string | null;
  accessExpiresAt: string | null;
  accessRevokedAt: string | null;
  approvalEmailSentAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
};

class ApiFail extends Error {
  constructor(public status: number, message: string, public body: ApiError & { request?: Req }) {
    super(message);
  }
}

const PAGE = `${BASE_PATH}/admin/cv-requests/`;

function when(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function access(r: Req): { label: string; active: boolean } | null {
  if (r.status !== "approved") return null;
  if (r.accessRevokedAt) return { label: `Turned off ${when(r.accessRevokedAt)}`, active: false };
  if (r.accessExpiresAt && Date.parse(r.accessExpiresAt) <= Date.now()) return { label: `Expired ${when(r.accessExpiresAt)}`, active: false };
  return { label: `Link active until ${when(r.accessExpiresAt)}`, active: true };
}

function params() {
  const q = new URLSearchParams(window.location.search);
  const id = q.get("id");
  const action = q.get("action");
  return {
    id: id && /^[0-9a-f-]{36}$/i.test(id) ? id : null,
    action: action === "approve" || action === "reject" ? action : null,
  } as { id: string | null; action: "approve" | "reject" | null };
}

export default function CvRequestsApp() {
  const [token, setToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<"boot" | "signin" | "ready">("boot");
  const [msg, setMsg] = useState("");
  const [view, setView] = useState<{ id: string | null; action: "approve" | "reject" | null }>({ id: null, action: null });

  useEffect(() => {
    const back = readReturnFromSignIn();
    if (back.redirecting) return;
    setView(params());
    if (back.error) {
      setMsg(back.error);
      setPhase("signin");
      return;
    }
    const tk = back.token || storedToken();
    if (tk) {
      setToken(tk);
      setPhase("ready");
    } else setPhase("signin");
  }, []);

  const api = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const res = await cvFetch(path, {
        ...init,
        headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        signOut();
        setToken(null);
        setMsg(
          res.status === 401
            ? "Your sign-in has expired. Sign in again to carry on."
            : "This account can't manage CV requests. Sign in as the site owner.",
        );
        setPhase("signin");
      }
      if (!res.ok) throw new ApiFail(res.status, body.error || "Something went wrong.", body);
      return body as T;
    },
    [token],
  );

  if (!CV_API_URL) {
    return (
      <Shell>
        <p className="text-muted">The CV request service isn&apos;t connected yet. See cv-requests/SETUP.md.</p>
      </Shell>
    );
  }
  if (phase === "boot") return null;
  if (phase === "signin" || !token) {
    return (
      <SignIn
        title="CV requests"
        subtitle="Sign in to approve or reject requests for your CV."
        message={msg}
        onToken={(tk) => {
          setMsg("");
          setToken(tk);
          setPhase("ready");
        }}
      />
    );
  }

  return (
    <Shell
      onSignOut={() => {
        signOut();
        setToken(null);
        setMsg("You're signed out.");
        setPhase("signin");
      }}
    >
      {view.id ? <Detail id={view.id} action={view.action} api={api} /> : <List api={api} />}
    </Shell>
  );
}

type Api = <T>(path: string, init?: RequestInit) => Promise<T>;

function Shell({ children, onSignOut }: { children: React.ReactNode; onSignOut?: () => void }) {
  return (
    <div className="min-h-dvh pb-20">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[720px] items-center justify-between gap-3 px-4 sm:px-6">
          <a href={PAGE} className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tracking-tight">avin.</span>
            <span className="text-[13px] text-muted">CV requests</span>
          </a>
          <div className="flex items-center gap-1">
            <a href={`${BASE_PATH}/admin/`} className="hidden h-8 items-center rounded-full px-2.5 text-[13px] text-muted hover:text-fg sm:inline-flex">
              Editor
            </a>
            <ThemeToggle />
            {onSignOut && (
              <button type="button" onClick={onSignOut} aria-label="Sign out" title="Sign out" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-fg">
                <LogOut size={16} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[720px] px-4 pt-8 sm:px-6 sm:pt-10">{children}</main>
    </div>
  );
}

function StatusBadge({ r }: { r: Req }) {
  const a = access(r);
  const tone =
    r.status === "pending"
      ? "border-amber-500/40 bg-amber-500/10"
      : r.status === "approved" && a?.active
        ? "border-emerald-500/40 bg-emerald-500/10"
        : "border-line bg-placeholder";
  const label = r.status === "pending" ? "Pending" : r.status === "rejected" ? "Rejected" : a?.active ? "Approved" : "Approved · link off";
  return <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[12.5px] font-medium ${tone}`}>{label}</span>;
}

/* ------------------------------------------------------------- one request */

function Detail({ id, action, api }: { id: string; action: "approve" | "reject" | null; api: Api }) {
  const [r, setR] = useState<Req | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [choice, setChoice] = useState<"approve" | "reject" | null>(action);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);

  useEffect(() => {
    api<{ request: Req }>(`/admin/requests/${id}`)
      .then((o) => setR(o.request))
      .catch((e: ApiFail) => setLoadErr(e.status === 404 ? "This request doesn't exist (it may have been deleted)." : e.message));
  }, [id, api]);

  const first = r?.fullName.split(" ")[0] || "them";
  const pendingTooLong = r?.status === "pending" && Date.now() - Date.parse(r.createdAt) > 30 * 864e5;

  async function run(label: string, path: string, body?: object) {
    if (busy) return; // one action at a time
    setBusy(label);
    setNote(null);
    try {
      const o = await api<{ request: Req; emailSent?: boolean | null; outcome: string }>(path, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      setR(o.request);
      return o;
    } catch (e) {
      const f = e as ApiFail;
      if (f.body?.request) setR(f.body.request);
      const map: Record<string, string> = {
        already_decided: "This request was already decided, so nothing changed.",
        expired: "This request is more than 30 days old and can no longer be decided.",
        not_active: "This link isn't active, so nothing changed.",
      };
      setNote({ kind: "err", text: (f.body?.outcome && map[f.body.outcome]) || f.message });
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    if (!choice) return;
    const o = await run(choice, `/admin/requests/${id}/decision`, { decision: choice });
    if (!o) return;
    if (choice === "reject") setNote({ kind: "ok", text: "Rejected. No email was sent." });
    else if (o.emailSent) setNote({ kind: "ok", text: `Approved. ${first} has been emailed a private link that works for 24 hours.` });
    else setNote({ kind: "warn", text: `Approved, but the email to ${first} didn't send. Use “Send a new link” to try again.` });
  }

  if (loadErr) return <Back>{<p role="alert" className="mt-6">{loadErr}</p>}</Back>;
  if (!r) return <Loading />;

  const a = access(r);
  return (
    <Back>
      <div className="mt-6 rounded-2xl border border-line p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.015em]">{r.fullName}</h1>
          <StatusBadge r={r} />
        </div>
        <dl className="mt-5 grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 text-[15px]">
          <dt className="text-muted">Email</dt>
          <dd className="break-all">{r.email}</dd>
          <dt className="text-muted">Reason</dt>
          <dd className="whitespace-pre-wrap break-words">{r.reason || <span className="text-muted">Not provided</span>}</dd>
          <dt className="text-muted">Requested</dt>
          <dd>{when(r.createdAt)}</dd>
          {r.decidedAt && (
            <>
              <dt className="text-muted">{r.status === "approved" ? "Approved" : "Rejected"}</dt>
              <dd>{when(r.decidedAt)}</dd>
            </>
          )}
          {a && (
            <>
              <dt className="text-muted">Access</dt>
              <dd>
                {a.label}
                {r.accessCount > 0 && <span className="text-muted"> · opened {r.accessCount}×</span>}
                {!r.approvalEmailSentAt && a.active && <span className="block text-amber-600 dark:text-amber-400">The link email hasn&apos;t been sent.</span>}
              </dd>
            </>
          )}
        </dl>
      </div>

      {note && (
        <p
          role={note.kind === "err" ? "alert" : "status"}
          className={`mt-5 rounded-xl border px-4 py-3 text-[14.5px] ${
            note.kind === "ok" ? "border-emerald-500/40 bg-emerald-500/10" : note.kind === "warn" ? "border-amber-500/40 bg-amber-500/10" : "border-red-500/40 bg-red-500/10"
          }`}
        >
          {note.text}
        </p>
      )}

      {r.status === "pending" && !pendingTooLong && (
        <div className="mt-6">
          {choice ? (
            <>
              <p className="text-[15px]">
                {choice === "approve"
                  ? `Approving emails ${first} a private link to your CV that works for 24 hours.`
                  : `Rejecting closes the request. ${first} won't get an email or the CV.`}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button kind={choice === "approve" ? "primary" : "secondary"} busy={busy === choice} onClick={confirm} className="h-11 px-5 text-[15px]">
                  {choice === "approve" ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
                  {choice === "approve" ? "Confirm Approve" : "Confirm Reject"}
                </Button>
                <Button kind="ghost" disabled={!!busy} onClick={() => setChoice(choice === "approve" ? "reject" : "approve")}>
                  {choice === "approve" ? "Reject instead" : "Approve instead"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button kind="primary" onClick={() => setChoice("approve")} className="h-11 px-5 text-[15px]">
                Approve…
              </Button>
              <Button onClick={() => setChoice("reject")} className="h-11 px-5 text-[15px]">
                Reject…
              </Button>
            </div>
          )}
        </div>
      )}
      {pendingTooLong && <p className="mt-6 text-muted">This request is more than 30 days old and can no longer be decided.</p>}

      {r.status === "approved" && !r.accessRevokedAt && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            busy={busy === "resend"}
            onClick={async () => {
              const o = await run("resend", `/admin/requests/${id}/resend`);
              if (o) setNote(o.emailSent ? { kind: "ok", text: `Sent ${first} a new link that works for 24 hours. The old one no longer works.` } : { kind: "warn", text: "The email didn't send. Please try again." });
            }}
          >
            Send a new link
          </Button>
          {a?.active && (
            <Button
              kind="danger"
              busy={busy === "revoke"}
              onClick={async () => {
                if (!window.confirm(`Turn off ${first}'s link now? They won't be able to open the CV again.`)) return;
                const o = await run("revoke", `/admin/requests/${id}/revoke`);
                if (o) setNote({ kind: "ok", text: "Link turned off." });
              }}
            >
              Turn off link
            </Button>
          )}
        </div>
      )}
    </Back>
  );
}

function Back({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <a href={PAGE} className="inline-flex items-center gap-1.5 text-[14px] text-muted hover:text-fg">
        <ArrowLeft size={15} aria-hidden /> All requests
      </a>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <p role="status" className="mt-6 flex items-center gap-2 text-muted">
      <Loader2 size={16} className="animate-spin" aria-hidden /> Loading…
    </p>
  );
}

/* --------------------------------------------------------------- dashboard */

const TABS = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
] as const;

function List({ api }: { api: Api }) {
  const [all, setAll] = useState<Req[] | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("pending");

  useEffect(() => {
    api<{ requests: Req[] }>("/admin/requests")
      .then((o) => setAll(o.requests))
      .catch((e: Error) => setErr(e.message));
  }, [api]);

  if (err) return <p role="alert">{err}</p>;
  if (!all) return <Loading />;
  const shown = all.filter((r) => r.status === tab);

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">CV requests</h1>
      <div role="tablist" aria-label="Status" className="mt-5 inline-flex rounded-full border border-line p-0.5">
        {TABS.map((t) => {
          const n = all.filter((r) => r.status === t.id).length;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`h-8 rounded-full px-3.5 text-[13.5px] ${tab === t.id ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
            >
              {t.label} <span className="opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 text-muted">Nothing here.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {shown.map((r) => {
            const a = access(r);
            return (
              <li key={r.id}>
                <a href={`${PAGE}?id=${r.id}`} className="flex items-start justify-between gap-4 py-4 hover:text-accent">
                  <span className="min-w-0">
                    <span className="block font-medium">{r.fullName}</span>
                    <span className="block truncate text-[14px] text-muted">{r.email}</span>
                    {a && <span className="block text-[13px] text-muted">{a.label}</span>}
                  </span>
                  <span className="shrink-0 text-[13px] text-muted">{when(r.createdAt)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
