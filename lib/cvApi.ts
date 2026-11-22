/**
 * Address of the CV request Worker (cv-requests/worker.js), set at build time.
 * Nothing secret lives here: the Worker holds every key. While this is empty,
 * the "Request CV" link stays hidden so the site looks exactly as before.
 */
export const CV_API_URL = (process.env.NEXT_PUBLIC_CV_API_URL || "").replace(/\/$/, "");

/** Cloudflare Turnstile site key (public by design). Empty means no Turnstile check. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export type ApiError = { error?: string; field?: string; reason?: string; outcome?: string };

/** fetch with a timeout, so a stalled network shows an error instead of spinning forever. */
export async function cvFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 20_000);
  try {
    return await fetch(`${CV_API_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}
