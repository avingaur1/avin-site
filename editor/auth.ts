/**
 * Sign-in.
 *
 * GitHub sign-in: the button sends you to the sign-in helper (a small Cloudflare Worker),
 * which talks to GitHub with the secret it keeps, checks the account is avingaur1,
 * and sends you back here with a short-lived key in the address bar's #fragment
 * (fragments are never sent to any server). It's read once and removed straight away.
 *
 * The key is kept in this tab only (sessionStorage) unless you tick "keep me signed in".
 */
import { AUTH_URL, BASE_PATH } from "./config";

const KEY = "avin-editor-token";
/** Page to go back to after GitHub sign-in, when it started somewhere other than /admin/. */
const RETURN_KEY = "avin-editor-return";

function safeReturnPath(p: string | null): string | null {
  // Only pages under /admin/ on this site, never another site or a protocol-relative URL.
  if (!p || p.startsWith("//") || !p.startsWith(`${BASE_PATH}/admin/`)) return null;
  return /^[A-Za-z0-9/_.\-?=&%]+$/.test(p) ? p : null;
}

export function readReturnFromSignIn(): { token?: string; error?: string; redirecting?: boolean } {
  if (typeof window === "undefined" || !window.location.hash) return {};
  const h = new URLSearchParams(window.location.hash.slice(1));
  const token = h.get("token") || undefined;
  const error = h.get("auth_error") || undefined;
  if (token || error) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  if (token) sessionStorage.setItem(KEY, token);
  if (token) {
    let back: string | null = null;
    try {
      back = safeReturnPath(sessionStorage.getItem(RETURN_KEY));
      sessionStorage.removeItem(RETURN_KEY);
    } catch {}
    if (back && back !== window.location.pathname + window.location.search) {
      window.location.replace(back);
      return { token, redirecting: true };
    }
  }
  return { token, error };
}

export function storedToken(): string | null {
  try {
    return sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string, remember: boolean) {
  try {
    sessionStorage.setItem(KEY, token);
    if (remember) localStorage.setItem(KEY, token);
  } catch {}
}

export function signOut() {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {}
}

export function startGitHubSignIn() {
  try {
    const here = window.location.pathname + window.location.search;
    if (safeReturnPath(here)) sessionStorage.setItem(RETURN_KEY, here);
    else sessionStorage.removeItem(RETURN_KEY);
  } catch {}
  window.location.href = `${AUTH_URL}/login`;
}

export const githubSignInAvailable = () => !!AUTH_URL;
