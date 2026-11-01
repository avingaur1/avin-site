/**
 * Sign-in helper for the website editor (/admin).
 *
 * GitHub Pages can't keep secrets, so this tiny Cloudflare Worker does the one step that needs one:
 * swapping GitHub's one-time sign-in code for an access key. It then checks the account is
 * ALLOWED_USER and hands the key back to the editor. It stores nothing.
 *
 * Settings (Cloudflare → Worker → Settings → Variables and Secrets):
 *   GITHUB_CLIENT_ID      text    from your GitHub App
 *   GITHUB_CLIENT_SECRET  secret  from your GitHub App  (type: Secret, never Text)
 *   ALLOWED_USER          text    avingaur1
 *   DASHBOARD_URL         text    https://avingaur.com/admin/
 *
 * Setup steps: see admin-auth/SETUP.md.
 */

const NO_STORE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

function back(env, params) {
  const url = new URL(env.DASHBOARD_URL);
  url.hash = new URLSearchParams(params).toString();
  return new Response(null, { status: 302, headers: { Location: url.toString(), ...NO_STORE } });
}

function cookie(req, name) {
  const m = (req.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : "";
}

async function revoke(env, token) {
  // Throw away a key that belongs to someone who isn't allowed in.
  await fetch(`https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`, {
    method: "DELETE",
    headers: {
      Authorization: `Basic ${btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`)}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "avin-site-editor",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ access_token: token }),
  }).catch(() => {});
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const missing = ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "ALLOWED_USER", "DASHBOARD_URL"].filter((k) => !env[k]);
    if (missing.length) {
      return new Response(`Sign-in helper is missing settings: ${missing.join(", ")}`, { status: 500, headers: NO_STORE });
    }

    // 1. The editor's "Sign in with GitHub" button lands here.
    if (url.pathname === "/login") {
      const state = crypto.randomUUID();
      const gh = new URL("https://github.com/login/oauth/authorize");
      gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      gh.searchParams.set("redirect_uri", `${url.origin}/callback`);
      gh.searchParams.set("state", state);
      gh.searchParams.set("login", env.ALLOWED_USER);
      return new Response(null, {
        status: 302,
        headers: {
          Location: gh.toString(),
          // Ties the reply from GitHub to this browser, so nobody can slip in their own sign-in.
          "Set-Cookie": `editor_state=${state}; Path=/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
          ...NO_STORE,
        },
      });
    }

    // 2. GitHub sends you back here after you approve.
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (url.searchParams.get("error")) return back(env, { auth_error: "Sign-in was cancelled." });
      if (!code || !state || state !== cookie(req, "editor_state")) {
        return back(env, { auth_error: "Sign-in expired or came from somewhere else. Please try again." });
      }

      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "avin-site-editor" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${url.origin}/callback`,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!out.access_token) return back(env, { auth_error: "GitHub didn't complete the sign-in. Please try again." });

      const me = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${out.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "avin-site-editor" },
      }).then((r) => (r.ok ? r.json() : null));

      if (!me || String(me.login).toLowerCase() !== env.ALLOWED_USER.toLowerCase()) {
        await revoke(env, out.access_token);
        return back(env, { auth_error: `Only ${env.ALLOWED_USER} can edit this site.` });
      }

      const resp = back(env, { token: out.access_token });
      resp.headers.append("Set-Cookie", "editor_state=; Path=/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
      return resp;
    }

    return new Response("Sign-in helper for the website editor.", { headers: { "Content-Type": "text/plain", ...NO_STORE } });
  },
};
