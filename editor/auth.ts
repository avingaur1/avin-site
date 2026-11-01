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
import { AUTH_URL } from "./config";

const KEY = "avin-editor-token";

export function readReturnFromSignIn(): { token?: string; error?: string } {
  if (typeof window === "undefined" || !window.location.hash) return {};
  const h = new URLSearchParams(window.location.hash.slice(1));
  const token = h.get("token") || undefined;
  const error = h.get("auth_error") || undefined;
  if (token || error) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  if (token) sessionStorage.setItem(KEY, token);
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
  window.location.href = `${AUTH_URL}/login`;
}

export const githubSignInAvailable = () => !!AUTH_URL;
