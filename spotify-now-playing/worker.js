/**
 * "Now playing" helper for the Music row on avingaur.com.
 *
 * GitHub Pages can't keep secrets, so this small Cloudflare Worker holds the Spotify keys,
 * asks Spotify what Avin is listening to, and hands the website only what it shows:
 * track name, artists, album art and the track's Spotify link. It is read-only: it uses
 * the single scope `user-read-currently-playing` and can never control playback.
 *
 * Settings (Cloudflare → Worker → Settings → Variables and Secrets):
 *   SPOTIFY_CLIENT_ID      text    from your Spotify app
 *   SPOTIFY_CLIENT_SECRET  secret  from your Spotify app        (type: Secret, never Text)
 *   SPOTIFY_REFRESH_TOKEN  secret  from the one-time /login step (type: Secret, never Text)
 *   ALLOWED_ORIGINS        text    https://avingaur.com,https://www.avingaur.com
 *   SETUP_KEY              secret  only while doing the one-time /login step; delete it afterwards
 *   CACHE_SECONDS          text    optional, default 25
 *   SPOTIFY_KV             KV      optional binding; keeps a new refresh token if Spotify ever issues one
 *
 * Endpoints:
 *   GET /now-playing                 JSON for the website
 *   GET /login?key=<SETUP_KEY>       one-time: connect your Spotify account
 *   GET /callback                    Spotify sends you back here; shows the refresh token once
 *
 * Setup steps: see spotify-now-playing/SETUP.md.
 */

const SCOPE = "user-read-currently-playing";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const NOW_URL = "https://api.spotify.com/v1/me/player/currently-playing";
const NO_STORE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const STALE_LIMIT_MS = 5 * 60 * 1000; // serve the last good answer for up to 5 minutes when Spotify is unreachable

// Kept in memory for as long as Cloudflare keeps this Worker instance warm.
let accessToken = { value: "", expires: 0 };
let latest = { body: null, at: 0 }; // last good answer
let inflight = null; // one Spotify request at a time, shared by everyone asking at once
let backoffUntil = 0; // set when Spotify says "slow down" (HTTP 429)

/* ---------------------------------------------------------------- helpers */

function allowedOrigin(req, env) {
  const origin = req.headers.get("Origin");
  if (!origin) return null;
  const list = (env.ALLOWED_ORIGINS || "https://avingaur.com,https://www.avingaur.com")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return list.includes(origin) ? origin : null;
}

function json(req, env, body, { status = 200, maxAge = 0 } = {}) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  };
  const origin = allowedOrigin(req, env);
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

function html(body, status = 200) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="robots" content="noindex"><title>Spotify setup</title>` +
      `<body style="font:15px/1.6 system-ui,sans-serif;max-width:620px;margin:48px auto;padding:0 20px;color:#181818">${body}</body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE } },
  );
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function cookie(req, name) {
  const m = (req.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : "";
}

function sameString(a, b) {
  // Length-independent comparison so the setup key can't be guessed one character at a time.
  if (typeof a !== "string" || typeof b !== "string") return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

const basicAuth = (env) => `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`;

/* ------------------------------------------------------------ Spotify auth */

async function refreshToken(env) {
  // A token saved by an earlier rotation wins over the one in Secrets.
  if (env.SPOTIFY_KV) {
    const saved = await env.SPOTIFY_KV.get("refresh_token").catch(() => null);
    if (saved) return saved;
  }
  return env.SPOTIFY_REFRESH_TOKEN;
}

async function getAccessToken(env) {
  if (accessToken.value && Date.now() < accessToken.expires) return accessToken.value;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(env), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: await refreshToken(env) }),
  });
  if (res.status === 429) {
    throw Object.assign(new Error("rate limited"), { retryAfter: Number(res.headers.get("Retry-After")) || 30 });
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.access_token) {
    // invalid_grant usually means the app was disconnected in your Spotify account settings.
    throw new Error(`token refresh failed (${res.status} ${out.error || ""})`);
  }

  // Spotify may hand out a new refresh token. Keep it if there is somewhere to keep it.
  if (out.refresh_token && env.SPOTIFY_KV) {
    await env.SPOTIFY_KV.put("refresh_token", out.refresh_token).catch(() => {});
  } else if (out.refresh_token && out.refresh_token !== env.SPOTIFY_REFRESH_TOKEN) {
    console.warn("Spotify issued a new refresh token. Bind a KV namespace as SPOTIFY_KV so it can be kept.");
  }

  accessToken = { value: out.access_token, expires: Date.now() + Math.max(60, (out.expires_in || 3600) - 60) * 1000 };
  return accessToken.value;
}

/* ------------------------------------------------------------ now playing */

/** Pick an image at least 128px wide (the card shows it at ~64px, so this stays sharp on retina). */
function pickArt(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  const sorted = images.filter((i) => i && i.url).sort((a, b) => (a.width || 0) - (b.width || 0));
  const good = sorted.find((i) => (i.width || 0) >= 128) || sorted[sorted.length - 1];
  return good && good.url.startsWith("https://") ? good.url : null;
}

function shape(data) {
  const item = data && data.item;
  // Paused, an ad, a podcast episode or a private session all count as "not listening".
  if (!data || !data.is_playing || data.currently_playing_type !== "track" || !item || item.type !== "track") {
    return { isPlaying: false };
  }
  const url = item.external_urls && item.external_urls.spotify;
  return {
    isPlaying: true,
    track: {
      id: item.id || item.uri || item.name,
      name: item.name || "Unknown track",
      artists: (item.artists || []).map((a) => a && a.name).filter(Boolean),
      album: (item.album && item.album.name) || "",
      albumArt: pickArt(item.album && item.album.images),
      url: typeof url === "string" && url.startsWith("https://open.spotify.com/") ? url : null,
    },
  };
}

async function askSpotify(env, retried = false) {
  const token = await getAccessToken(env);
  const res = await fetch(NOW_URL, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 204) return { isPlaying: false }; // nothing playing
  if (res.status === 401 && !retried) {
    accessToken = { value: "", expires: 0 }; // expired early; get a fresh one and try once more
    return askSpotify(env, true);
  }
  if (res.status === 429) {
    throw Object.assign(new Error("rate limited"), { retryAfter: Number(res.headers.get("Retry-After")) || 30 });
  }
  if (!res.ok) throw new Error(`Spotify returned ${res.status}`);
  return shape(await res.json().catch(() => null));
}

async function nowPlaying(req, env, ctx) {
  const ttl = Math.min(120, Math.max(10, Number(env.CACHE_SECONDS) || 25));
  const now = Date.now();

  // 1. Fresh enough answer already in memory.
  if (latest.body && now - latest.at < ttl * 1000) {
    return json(req, env, latest.body, { maxAge: Math.ceil((ttl * 1000 - (now - latest.at)) / 1000) });
  }

  // 2. Shared edge cache (only active on a custom domain; a no-op on *.workers.dev).
  const cacheKey = new Request(new URL("/__now-playing-cache", req.url).toString());
  const cache = typeof caches !== "undefined" ? caches.default : null;
  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => null);
    if (hit) {
      const body = await hit.json().catch(() => null);
      if (body) {
        latest = { body, at: body.fetchedAt || now };
        return json(req, env, body, { maxAge: ttl });
      }
    }
  }

  // 3. While Spotify has asked us to wait, keep showing the last answer.
  if (now < backoffUntil) {
    return latest.body
      ? json(req, env, { ...latest.body, stale: true }, { maxAge: 15 })
      : json(req, env, { isPlaying: false, unavailable: true }, { status: 503 });
  }

  // 4. Ask Spotify (once, even if many visitors arrive at the same moment).
  try {
    inflight = inflight || askSpotify(env).finally(() => (inflight = null));
    const body = { ...(await inflight), fetchedAt: Date.now() };
    latest = { body, at: body.fetchedAt };
    if (cache) {
      const stored = new Response(JSON.stringify(body), { headers: { "Cache-Control": `public, max-age=${ttl}` } });
      ctx.waitUntil(cache.put(cacheKey, stored).catch(() => {}));
    }
    return json(req, env, body, { maxAge: ttl });
  } catch (err) {
    if (err.retryAfter) backoffUntil = Date.now() + Math.min(600, err.retryAfter) * 1000;
    console.error("now-playing:", err.message);
    if (latest.body && Date.now() - latest.at < STALE_LIMIT_MS) {
      return json(req, env, { ...latest.body, stale: true }, { maxAge: 15 });
    }
    return json(req, env, { isPlaying: false, unavailable: true }, { status: 503 });
  }
}

/* ------------------------------------------------------- one-time setup */

function login(req, env) {
  const url = new URL(req.url);
  if (!env.SETUP_KEY || !sameString(url.searchParams.get("key") || "", env.SETUP_KEY)) {
    return new Response("Not found", { status: 404, headers: NO_STORE });
  }
  const state = crypto.randomUUID();
  const auth = new URL("https://accounts.spotify.com/authorize");
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("client_id", env.SPOTIFY_CLIENT_ID);
  auth.searchParams.set("scope", SCOPE);
  auth.searchParams.set("redirect_uri", `${url.origin}/callback`);
  auth.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: auth.toString(),
      // Ties Spotify's reply to this browser, so nobody can slip in their own sign-in.
      "Set-Cookie": `spotify_state=${state}; Path=/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      ...NO_STORE,
    },
  });
}

async function callback(req, env) {
  const url = new URL(req.url);
  if (!env.SETUP_KEY) return new Response("Not found", { status: 404, headers: NO_STORE });
  if (url.searchParams.get("error")) return html(`<p>Spotify sign-in was cancelled. You can close this tab.</p>`, 400);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== cookie(req, "spotify_state")) {
    return html(`<p>This sign-in expired or came from somewhere else. Open <code>/login?key=…</code> again.</p>`, 400);
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(env), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: `${url.origin}/callback` }),
  });
  const out = await res.json().catch(() => ({}));
  if (!out.refresh_token) {
    return html(`<p>Spotify didn't complete the sign-in (${escapeHtml(out.error_description || out.error || res.status)}). Please try again.</p>`, 400);
  }
  if (out.scope && out.scope.split(" ").some((s) => s && s !== SCOPE)) {
    return html(`<p>Spotify granted more access than expected. Please try again.</p>`, 400);
  }

  const resp = html(
    `<h1 style="font-size:20px">Spotify connected</h1>
     <p>Copy this refresh token. It is shown only once and is not stored anywhere.</p>
     <textarea readonly rows="5" style="width:100%;font:13px ui-monospace,monospace;padding:10px;border:1px solid #ddd;border-radius:6px" onclick="this.select()">${escapeHtml(out.refresh_token)}</textarea>
     <ol>
       <li>Cloudflare → this Worker → <b>Settings → Variables and Secrets</b> → add a <b>Secret</b> named <code>SPOTIFY_REFRESH_TOKEN</code> with this value.</li>
       <li><b>Delete</b> the <code>SETUP_KEY</code> secret, so this page can't be used again.</li>
       <li>Deploy, then close this tab.</li>
     </ol>`,
  );
  resp.headers.append("Set-Cookie", "spotify_state=; Path=/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return resp;
}

/* ------------------------------------------------------------------ router */

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const missing = ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"].filter((k) => !env[k]);
    if (missing.length) {
      return new Response(`Now-playing helper is missing settings: ${missing.join(", ")}`, { status: 500, headers: NO_STORE });
    }

    if (req.method === "OPTIONS") {
      const origin = allowedOrigin(req, env);
      return new Response(null, {
        status: 204,
        headers: {
          ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        },
      });
    }
    if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: NO_STORE });

    if (url.pathname === "/now-playing" || url.pathname === "/") {
      if (!(await refreshToken(env))) {
        return json(req, env, { isPlaying: false, unavailable: true, reason: "not connected yet" }, { status: 503 });
      }
      return nowPlaying(req, env, ctx);
    }
    if (url.pathname === "/login") return login(req, env);
    if (url.pathname === "/callback") return callback(req, env);

    return new Response("Not found", { status: 404, headers: NO_STORE });
  },
};
