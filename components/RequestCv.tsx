"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { CV_API_URL, TURNSTILE_SITE_KEY, cvFetch, type ApiError } from "@/lib/cvApi";

/**
 * "Request CV ↗" in Let's Connect, and the small form it opens.
 * The form posts to the CV Worker (cv-requests/worker.js); nothing secret is in this file.
 */

const LIMITS = { name: 100, email: 254, reason: 1000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

type Errors = Partial<Record<"name" | "email" | "reason" | "form", string>>;

export function RequestCv() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  if (!CV_API_URL) return null;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="group inline-flex cursor-pointer items-baseline gap-1 text-fg hover:text-accent"
      >
        Request CV
        <span
          aria-hidden
          className="inline-block text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
        >
          ↗
        </span>
      </button>
      {open && (
        <RequestCvDialog
          onClose={() => {
            setOpen(false);
            // Give focus back to the link that opened the form.
            requestAnimationFrame(() => trigger.current?.focus());
          }}
        />
      )}
    </>
  );
}

function RequestCvDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sending = useRef(false);
  const ids = { title: useId(), name: useId(), email: useId(), reason: useId(), err: useId() };

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [errors, setErrors] = useState<Errors>({});
  const [phase, setPhase] = useState<"form" | "sending" | "done">("form");
  const turnstile = useTurnstile();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // showModal() focuses the first button (Close); start in the name field instead.
    d?.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    // Keep the page behind still while the form is open.
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  const close = useCallback(() => {
    ref.current?.close();
    onClose();
  }, [onClose]);

  function check(): Errors {
    const e: Errors = {};
    const n = name.trim();
    const m = email.trim();
    if (!n) e.name = "Please enter your full name.";
    else if (n.length > LIMITS.name) e.name = `Please keep your name under ${LIMITS.name} characters.`;
    if (!m) e.email = "Please enter your email address.";
    else if (m.length > LIMITS.email || !EMAIL_RE.test(m)) e.email = "Please enter a valid email address.";
    if (reason.trim().length > LIMITS.reason) e.reason = `Please keep this under ${LIMITS.reason} characters.`;
    return e;
  }

  function focusFirstError(e: Errors) {
    const first = (["name", "email", "reason"] as const).find((k) => e[k]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (sending.current) return; // no double submissions
    const e = check();
    setErrors(e);
    if (Object.keys(e).length) return focusFirstError(e);

    let turnstileToken: string | undefined;
    if (TURNSTILE_SITE_KEY) {
      turnstileToken = turnstile.token();
      if (!turnstileToken) {
        setErrors({ form: "One moment: a quick check is still running. Please try again in a second." });
        return;
      }
    }

    sending.current = true;
    setPhase("sending");
    try {
      const res = await cvFetch("/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), reason: reason.trim(), website, turnstileToken }),
      });
      if (res.ok) {
        setPhase("done");
        return;
      }
      const out: ApiError = await res.json().catch(() => ({}));
      const msg = out.error || "Something went wrong. Please try again.";
      const field = out.field === "name" || out.field === "email" || out.field === "reason" ? out.field : null;
      const next: Errors = field ? { [field]: msg } : { form: msg };
      setErrors(next);
      setPhase("form");
      if (field) requestAnimationFrame(() => focusFirstError(next));
    } catch {
      setErrors({ form: "Couldn't send your request. Check your connection and try again." });
      setPhase("form");
    } finally {
      sending.current = false;
      turnstile.reset(); // tokens are single-use
    }
  }

  const busy = phase === "sending";
  const inputCls = (bad?: string) =>
    `mt-1.5 w-full rounded-lg border bg-bg px-3 py-2.5 text-[16px] leading-snug text-fg outline-none transition-colors placeholder:text-muted/70 focus:border-accent ${
      bad ? "border-red-500/70" : "border-line"
    }`;

  return (
    <dialog
      ref={ref}
      aria-labelledby={ids.title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close(); // click on the dimmed backdrop
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[460px] overflow-y-auto rounded-2xl border border-line bg-bg p-0 text-fg shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="relative p-6 sm:p-7">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-fg"
        >
          <X size={18} aria-hidden />
        </button>

        <h2 id={ids.title} className="pr-8 text-[22px] font-semibold leading-tight tracking-[-0.015em]">
          Request My CV
        </h2>

        {phase === "done" ? (
          <div className="mt-4">
            <p role="status" className="text-[15px]">
              Request submitted! You&apos;ll receive an email if your request is approved.
            </p>
            <div className="mt-7 flex justify-end">
              <button
                type="button"
                autoFocus
                onClick={close}
                className="inline-flex h-10 items-center rounded-full bg-fg px-5 text-[14px] font-medium text-bg hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form ref={formRef} noValidate onSubmit={submit} className="mt-2" aria-describedby={errors.form ? ids.err : undefined}>
            <p className="text-[14.5px] text-muted">I&apos;ll email you a private link if I approve your request.</p>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor={ids.name} className="block text-[13.5px] font-medium">
                  Full Name
                </label>
                <input
                  id={ids.name}
                  name="name"
                  autoFocus
                  autoComplete="name"
                  required
                  maxLength={LIMITS.name}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? `${ids.name}-e` : undefined}
                  className={inputCls(errors.name)}
                />
                {errors.name && <FieldError id={`${ids.name}-e`}>{errors.name}</FieldError>}
              </div>

              <div>
                <label htmlFor={ids.email} className="block text-[13.5px] font-medium">
                  Email Address
                </label>
                <input
                  id={ids.email}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="off"
                  spellCheck={false}
                  required
                  maxLength={LIMITS.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? `${ids.email}-e` : undefined}
                  className={inputCls(errors.email)}
                />
                {errors.email && <FieldError id={`${ids.email}-e`}>{errors.email}</FieldError>}
              </div>

              <div>
                <label htmlFor={ids.reason} className="flex items-baseline justify-between text-[13.5px] font-medium">
                  <span>Reason for Requesting CV</span>
                  <span className="font-normal text-muted">Optional</span>
                </label>
                <textarea
                  id={ids.reason}
                  name="reason"
                  rows={4}
                  maxLength={LIMITS.reason}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  aria-invalid={!!errors.reason}
                  aria-describedby={`${ids.reason}-c${errors.reason ? ` ${ids.reason}-e` : ""}`}
                  className={`${inputCls(errors.reason)} resize-y`}
                />
                <div className="mt-1 flex justify-between gap-3 text-[12.5px] text-muted">
                  <span>{errors.reason && <FieldError id={`${ids.reason}-e`}>{errors.reason}</FieldError>}</span>
                  <span id={`${ids.reason}-c`} className={reason.length > LIMITS.reason * 0.8 ? "" : "sr-only"}>
                    {reason.length}/{LIMITS.reason}
                  </span>
                </div>
              </div>

              {/* Honeypot: hidden from people and screen readers; bots tend to fill it. */}
              <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </label>
              </div>

              {TURNSTILE_SITE_KEY && <div ref={turnstile.mount} className="min-h-0 [&:empty]:hidden" />}
            </div>

            {errors.form && (
              <p id={ids.err} role="alert" className="mt-5 rounded-lg border border-red-500/30 bg-red-500/5 px-3.5 py-2.5 text-[14px]">
                {errors.form}
              </p>
            )}

            <div className="mt-7 flex justify-end">
              <button
                type="submit"
                disabled={busy}
                aria-disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-fg px-5 text-[14px] font-medium text-bg transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
              >
                {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
                {busy ? "Submitting…" : "Submit Request"}
              </button>
            </div>
            <p aria-live="polite" className="sr-only">
              {busy ? "Submitting your request" : ""}
            </p>
          </form>
        )}
      </div>
    </dialog>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <span id={id} className="mt-1.5 block text-[13px] text-red-600 dark:text-red-400">
      {children}
    </span>
  );
}

/* ------------------------------------------------------- Cloudflare Turnstile */

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  getResponse: (id: string) => string | undefined;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ||= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile failed to load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Loads Turnstile only when the form opens. "interaction-only" keeps it invisible for almost
 * everyone; a checkbox appears only if Cloudflare is unsure.
 */
function useTurnstile() {
  const widget = useRef<string | null>(null);
  const el = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !el.current || !window.turnstile) return;
        widget.current = window.turnstile.render(el.current, {
          sitekey: TURNSTILE_SITE_KEY,
          appearance: "interaction-only",
          size: "flexible",
          theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
          action: "cv-request",
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, []);

  return {
    mount: (node: HTMLDivElement | null) => {
      el.current = node;
    },
    token: () => (widget.current && window.turnstile?.getResponse(widget.current)) || undefined,
    reset: () => {
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
    },
  };
}
