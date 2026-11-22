"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { CV_API_URL, cvFetch, type ApiError } from "@/lib/cvApi";

/**
 * Private CV viewer at /cv/#t=<token>.
 *
 * The token comes in the #fragment, which browsers never send to the web server, and it's removed
 * from the address bar straight away (kept for this tab only, so a refresh still works).
 * It's then sent to the CV Worker in a POST body, which checks it on every load and streams
 * the PDF back with no-store headers. There is no permanent or public URL for the file.
 */

const KEY = "avin-cv-access";
const FILENAME = "Avin-Gaur-CV.pdf";

type State =
  | { kind: "loading" }
  | { kind: "ready"; url: string; expires: string | null }
  | { kind: "error"; reason: "missing" | "invalid" | "expired" | "revoked" | "unavailable" | "network" };

function readToken(): string | null {
  try {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const t = h.get("t");
    if (t) {
      sessionStorage.setItem(KEY, t);
      history.replaceState(null, "", window.location.pathname);
      return t;
    }
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function forget() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

export function CvViewer() {
  const [state, setState] = useState<State>({ kind: "loading" });
  // A different link opened in this same tab only changes the #fragment; load again for it.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const again = () => {
      if (window.location.hash.includes("t=")) setAttempt((n) => n + 1);
    };
    window.addEventListener("hashchange", again);
    return () => window.removeEventListener("hashchange", again);
  }, []);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setState({ kind: "loading" });
    (async () => {
      const token = readToken();
      if (!token || !CV_API_URL) return setState({ kind: "error", reason: "missing" });
      try {
        const res = await cvFetch("/cv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          timeoutMs: 30_000,
        });
        if (!res.ok) {
          const out: ApiError = await res.json().catch(() => ({}));
          const reason = out.reason === "expired" || out.reason === "revoked" || out.reason === "invalid" ? out.reason : null;
          if (reason) forget();
          if (cancelled) return;
          return setState({ kind: "error", reason: reason || (res.status === 503 ? "unavailable" : "network") });
        }
        const blob = new Blob([await res.arrayBuffer()], { type: "application/pdf" });
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setState({ kind: "ready", url, expires: res.headers.get("X-Access-Expires") });
      } catch {
        if (!cancelled) setState({ kind: "error", reason: "network" });
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attempt]);

  if (state.kind === "loading") {
    return (
      <div role="status" className="flex items-center gap-2 text-muted">
        <Loader2 size={16} className="animate-spin" aria-hidden /> Opening the CV…
      </div>
    );
  }

  if (state.kind === "error") {
    const copy = {
      missing: ["This page needs your link", "Open the “View CV” link from your approval email."],
      invalid: ["This link isn't valid", "Check that you opened the whole link from your approval email."],
      expired: ["This link has expired", "CV links stay active for 24 hours after approval."],
      revoked: ["This link is no longer active", "Access to this CV has been turned off."],
      unavailable: ["The CV isn't available right now", "Please try again in a little while."],
      network: ["Couldn't open the CV", "Check your connection and refresh the page."],
    }[state.reason];
    return (
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] md:text-[32px]">{copy[0]}</h1>
        <p className="mt-3 max-w-[560px] text-muted">{copy[1]}</p>
        {(state.reason === "expired" || state.reason === "revoked" || state.reason === "missing") && (
          <p className="mt-6">
            <Link href="/#connect" className="group inline-flex items-baseline gap-1 text-fg hover:text-accent">
              Request it again
              <span aria-hidden className="inline-block text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent">
                ↗
              </span>
            </Link>
          </p>
        )}
      </div>
    );
  }

  const until = state.expires
    ? new Date(state.expires).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div>
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] md:text-[32px]">Avin Gaur · CV</h1>
      {until && <p className="mt-2 text-muted">This link works until {until}.</p>}

      <div className="mt-6 flex flex-wrap gap-2.5">
        <a
          href={state.url}
          download={FILENAME}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-fg px-5 text-[14px] font-medium text-bg hover:opacity-90"
        >
          <Download size={15} aria-hidden /> Download PDF
        </a>
        <a
          href={state.url}
          target="_blank"
          rel="noopener"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-5 text-[14px] font-medium text-fg hover:border-fg/40"
        >
          <ExternalLink size={15} aria-hidden /> Open in new tab
        </a>
      </div>

      {/* Phones show PDFs best in their own viewer, so the inline preview is for larger screens. */}
      <iframe
        src={`${state.url}#view=FitH`}
        title="Avin Gaur's CV"
        className="mt-8 hidden h-[80vh] w-full rounded-xl border border-line bg-placeholder md:block"
      />
      <p className="mt-8 text-[13px] text-muted">Please don&apos;t share this link; it was sent just to you.</p>
    </div>
  );
}
