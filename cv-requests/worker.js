/**
 * CV request & approval service for avingaur.com.
 *
 * GitHub Pages can't run code or keep secrets, so this Cloudflare Worker does everything that needs
 * one: it saves CV requests in Supabase, emails Avin through Resend, lets ONLY Avin approve or
 * reject (checked against his GitHub sign-in, the same one the /admin editor uses), emails approved
 * visitors a private 24-hour link, and streams the CV PDF out of a private Supabase bucket after
 * checking that link on every request.
 *
 * The CV never has a public URL. The access token is random (256 bits), only its SHA-256 is stored,
 * it travels in the page's #fragment (never sent to GitHub Pages) and then only in POST bodies
 * (never in a URL, so it can't end up in logs or referrers).
 *
 * Settings (Cloudflare → Worker → Settings → Variables and Secrets). See cv-requests/SETUP.md.
 *   SUPABASE_URL           text    https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_KEY   secret  Supabase secret key (sb_secret_…) or legacy service_role key
 *   RESEND_API_KEY         secret  Resend API key (sending access only)
 *   MAIL_FROM              text    e.g. "Avin Gaur <cv@mail.avingaur.com>" (a Resend-verified domain)
 *   ADMIN_EMAIL            secret  where new-request emails go (kept out of the code)
 *   REPLY_TO               text    optional: reply-to address on the approval email
 *   ADMIN_GITHUB_LOGIN     text    avingaur1  (the only GitHub account allowed to decide)
 *   ADMIN_GITHUB_ID        text    optional: your numeric GitHub user id, for extra certainty
 *   IP_HASH_SALT           secret  any long random string (rate limiting stores only salted IP hashes)
 *   TURNSTILE_SECRET_KEY   secret  optional: Cloudflare Turnstile secret. When set, a valid
 *                                  Turnstile response is required on every request form.
 *   SITE_URL               text    https://avingaur.com
 *   ALLOWED_ORIGINS        text    https://avingaur.com,https://www.avingaur.com
 *   CV_BUCKET              text    optional, default private-cv
 *   CV_OBJECT_PATH         text    optional, default cv.pdf
 *   CV_FILENAME            text    optional, default Avin-Gaur-CV.pdf
 *   ACCESS_HOURS           text    optional, default 24
 *   TIMEZONE               text    optional, default Asia/Kolkata (dates in your emails)
 *
 * Endpoints:
 *   POST /requests                     public: submit a request {name, email, reason?, turnstileToken?}
 *   POST /cv                           public: {token} → the PDF, if the link is valid
 *   GET  /admin/requests?status=       admin: list requests
 *   GET  /admin/requests/:id           admin: one request
 *   POST /admin/requests/:id/decision  admin: {decision: "approve" | "reject"}
 *   POST /admin/requests/:id/revoke    admin: turn an approved link off now
 *   POST /admin/requests/:id/resend    admin: send a fresh 24-hour link (old one stops working)
 *   GET  /health
 * Plus a daily Cron Trigger (see wrangler.toml) that keeps a free Supabase project awake.
 * Admin endpoints need "Authorization: Bearer <GitHub key>" belonging to ADMIN_GITHUB_LOGIN.
 */

const LIMITS = { name: 100, email: 254, reason: 1000, body: 8 * 1024 };
const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

/* ------------------------------------------------------------------ helpers */

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function origins(env) {
  return (env.ALLOWED_ORIGINS || "https://avingaur.com,https://www.avingaur.com")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin");
  if (!origin || !origins(env).includes(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Expose-Headers": "X-Access-Expires",
    Vary: "Origin",
  };
}

function json(req, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...BASE_HEADERS, ...corsHeaders(req, env) },
  });
}

async function readJson(req) {
  const type = req.headers.get("Content-Type") || "";
  if (!type.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Expected JSON.");
  const text = await req.text();
  if (text.length > LIMITS.body) throw new HttpError(413, "That's too long.");
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new HttpError(400, "Couldn't read the request.");
  }
}

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** One line of text: no control or invisible formatting characters, single spaces. */
function cleanLine(v) {
  if (typeof v !== "string") return "";
  return v
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Multi-line text: keeps line breaks (max one blank line), drops other control characters. */
function cleanText(v) {
  if (typeof v !== "string") return "";
  return v
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069\ufeff]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function validateRequest(body) {
  const name = cleanLine(body.name);
  const email = cleanLine(body.email).toLowerCase();
  const reason = cleanText(body.reason ?? "");
  if (!name) throw new HttpError(400, "Please enter your full name.", { field: "name" });
  if (name.length > LIMITS.name) throw new HttpError(400, `Please keep your name under ${LIMITS.name} characters.`, { field: "name" });
  if (!/\p{L}/u.test(name) || /:\/\/|www\./i.test(name)) throw new HttpError(400, "Please enter your name.", { field: "name" });
  if (!email) throw new HttpError(400, "Please enter your email address.", { field: "email" });
  if (email.length > LIMITS.email || !EMAIL_RE.test(email) || email.includes(".."))
    throw new HttpError(400, "Please enter a valid email address.", { field: "email" });
  if (reason.length > LIMITS.reason)
    throw new HttpError(400, `Please keep the reason under ${LIMITS.reason} characters.`, { field: "reason" });
  return { name, email, reason: reason || null };
}

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(text) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); // 43 chars
}

const siteUrl = (env) => (env.SITE_URL || "https://avingaur.com").replace(/\/$/, "");
const accessHours = (env) => Math.min(168, Math.max(1, Number(env.ACCESS_HOURS) || 24));

function formatDate(iso, env) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: env.TIMEZONE || "Asia/Kolkata",
      timeZoneName: "short",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

/* ----------------------------------------------------------------- Supabase */

async function rpc(env, fn, args) {
  const key = env.SUPABASE_SERVICE_KEY;
  const headers = { apikey: key, "Content-Type": "application/json", Accept: "application/json" };
  // Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys only in apikey.
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  });
  // Never log the response body: it can contain the requester's details.
  if (!res.ok) throw new Error(`database call ${fn} failed (${res.status})`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const one = (rows) => (Array.isArray(rows) ? rows[0] : rows) || null;

async function fetchCv(env) {
  const key = env.SUPABASE_SERVICE_KEY;
  const headers = { apikey: key };
  headers.Authorization = `Bearer ${key}`; // storage accepts either key type here
  const bucket = encodeURIComponent(env.CV_BUCKET || "private-cv");
  const path = (env.CV_OBJECT_PATH || "cv.pdf").split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/authenticated/${bucket}/${path}`, {
    headers,
  });
  if (res.status === 400 || res.status === 404) throw new HttpError(503, "The CV isn't available right now. Please try again later.");
  if (!res.ok) throw new Error(`storage read failed (${res.status})`);
  return res;
}

/* ------------------------------------------------------------------- Resend */

async function sendEmail(env, { to, subject, html, text, replyTo, idempotencyKey }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) throw new Error(`email send failed (${res.status})`);
}

/* ---------------------------------------------------------- email templates */

const C = { bg: "#fafaf8", card: "#ffffff", fg: "#181818", muted: "#666666", line: "#e5e5e5", accent: "#315cfd" };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function button(href, label, primary) {
  const style = primary
    ? `background:${C.fg};color:#ffffff;border:1px solid ${C.fg};`
    : `background:#ffffff;color:${C.fg};border:1px solid #cfcfcf;`;
  return `<a href="${escapeHtml(href)}" target="_blank" style="${style}display:inline-block;padding:11px 20px;border-radius:999px;font:600 14px/1 ${FONT};text-decoration:none;">${escapeHtml(label)}</a>`;
}

function layout(preheader, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title></title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.card};border:1px solid ${C.line};border-radius:16px;">
<tr><td style="padding:28px 28px 8px;font:600 15px/1 ${FONT};color:${C.fg};letter-spacing:-0.01em;">avin.</td></tr>
<tr><td style="padding:12px 28px 28px;font:15px/1.65 ${FONT};color:${C.fg};">${inner}</td></tr>
</table></td></tr></table></body></html>`;
}

export function adminEmail(env, r) {
  const base = `${siteUrl(env)}/admin/cv-requests/?id=${encodeURIComponent(r.id)}`;
  const when = formatDate(r.createdAt, env);
  const row = (label, value) =>
    `<tr><td style="padding:8px 0;border-top:1px solid ${C.line};width:120px;vertical-align:top;color:${C.muted};font:14px/1.6 ${FONT};">${label}</td>` +
    `<td style="padding:8px 0;border-top:1px solid ${C.line};vertical-align:top;font:14px/1.6 ${FONT};color:${C.fg};word-break:break-word;">${value}</td></tr>`;
  const reasonHtml = r.reason
    ? escapeHtml(r.reason).replace(/\n/g, "<br>")
    : `<span style="color:${C.muted};">Not provided</span>`;
  const html = layout(
    `${r.fullName} asked for your CV`,
    `<h1 style="margin:0 0 16px;font:600 22px/1.3 ${FONT};letter-spacing:-0.015em;">New CV Access Request</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row("Name", escapeHtml(r.fullName))}
${row("Email", escapeHtml(r.email))}
${row("Reason", reasonHtml)}
${row("Requested On", escapeHtml(when))}
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr>
<td style="padding:0 10px 10px 0;">${button(`${base}&action=approve`, "Approve Request", true)}</td>
<td style="padding:0 0 10px 0;">${button(`${base}&action=reject`, "Reject Request", false)}</td>
</tr></table>
<p style="margin:16px 0 0;font:13px/1.6 ${FONT};color:${C.muted};">Both buttons open a confirmation page. Nothing changes until you confirm there while signed in.</p>`,
  );
  const text = [
    "New CV Access Request",
    "",
    `Name: ${r.fullName}`,
    `Email: ${r.email}`,
    `Reason: ${r.reason || "Not provided"}`,
    `Requested On: ${when}`,
    "",
    `Approve Request: ${base}&action=approve`,
    `Reject Request: ${base}&action=reject`,
    "",
    "Both links open a confirmation page. Nothing changes until you confirm there while signed in.",
  ].join("\n");
  // Names are already single-line; strip anything odd for the subject anyway.
  return { subject: `New CV Access Request — ${cleanLine(r.fullName).slice(0, 100)}`, html, text };
}

export function approvalEmail(env, r, token) {
  const link = `${siteUrl(env)}/cv/#t=${token}`;
  const first = escapeHtml(cleanLine(r.fullName).split(" ")[0] || "there");
  const hours = accessHours(env);
  const period = hours === 24 ? "24 hours" : `${hours} hours`;
  const html = layout(
    "Your request to view my CV has been approved.",
    `<p style="margin:0 0 14px;">Hi ${first},</p>
<p style="margin:0 0 14px;">Thanks for your interest!</p>
<p style="margin:0 0 14px;">Your request to access my CV has been approved.</p>
<p style="margin:0 0 22px;">You can view my CV using the link below.</p>
<p style="margin:0 0 22px;">${button(link, "View CV", true)}</p>
<p style="margin:0 0 22px;color:${C.muted};font-size:14px;">This link will remain active for ${period}.</p>
<p style="margin:0;">Best,<br>Avin Gaur</p>
<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid ${C.line};font:12.5px/1.6 ${FONT};color:${C.muted};">If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all;">${escapeHtml(link)}</span><br>Please don't forward it: it's meant just for you.</p>`,
  );
  const text = [
    `Hi ${cleanLine(r.fullName).split(" ")[0] || "there"},`,
    "",
    "Thanks for your interest!",
    "",
    "Your request to access my CV has been approved.",
    "",
    "You can view my CV using the link below.",
    "",
    `View CV: ${link}`,
    "",
    `This link will remain active for ${period}.`,
    "",
    "Best,",
    "Avin Gaur",
  ].join("\n");
  return { subject: "Your CV Access Request Has Been Approved", html, text };
}

/* ------------------------------------------------------------- bot defences */

async function checkTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET_KEY) return; // not configured: rely on honeypot + rate limits
  if (typeof token !== "string" || !token || token.length > 2048) {
    throw new HttpError(400, "Please complete the quick check and try again.", { field: "turnstile" });
  }
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const out = await res.json().catch(() => ({}));
  if (!out.success) throw new HttpError(400, "The quick check didn't pass. Please try again.", { field: "turnstile" });
}

/* ------------------------------------------------------------- admin access */

const adminCache = new Map(); // sha256(key) → { ok, until }

async function requireAdmin(req, env) {
  const m = (req.headers.get("Authorization") || "").match(/^Bearer ([A-Za-z0-9_.-]{20,512})$/);
  if (!m) throw new HttpError(401, "Please sign in.");
  const cacheKey = await sha256(m[1]);
  const hit = adminCache.get(cacheKey);
  if (hit && hit.until > Date.now()) {
    if (!hit.ok) throw new HttpError(403, "Only the site owner can do this.");
    return;
  }
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${m[1]}`, Accept: "application/vnd.github+json", "User-Agent": "avin-cv-requests" },
  });
  if (res.status >= 500) throw new HttpError(502, "Couldn't check your sign-in with GitHub. Please try again.");
  if (res.status === 401) throw new HttpError(401, "Your sign-in has expired. Please sign in again.");
  const me = res.ok ? await res.json().catch(() => null) : null;
  const ok =
    !!me &&
    String(me.login || "").toLowerCase() === String(env.ADMIN_GITHUB_LOGIN || "").toLowerCase() &&
    (!env.ADMIN_GITHUB_ID || String(me.id) === String(env.ADMIN_GITHUB_ID));
  if (adminCache.size > 200) adminCache.clear();
  adminCache.set(cacheKey, { ok, until: Date.now() + (ok ? 120_000 : 30_000) });
  if (!ok) throw new HttpError(403, "Only the site owner can do this.");
}

/* ----------------------------------------------------------------- handlers */

async function submitRequest(req, env, ctx) {
  const body = await readJson(req);
  // Honeypot: real people never see or fill this field. Pretend it worked.
  if (typeof body.website === "string" && body.website.trim()) return json(req, env, { ok: true });

  const input = validateRequest(body);
  const ip = req.headers.get("CF-Connecting-IP") || "";
  await checkTurnstile(env, body.turnstileToken, ip);

  const ipHash = ip ? (await sha256(`${env.IP_HASH_SALT || ""}|${ip}`)).slice(0, 32) : null;
  const result = one(
    await rpc(env, "cv_submit_request", {
      p_full_name: input.name,
      p_email: input.email,
      p_reason: input.reason,
      p_ip_hash: ipHash,
    }),
  );
  const outcome = result && result.outcome;

  if (outcome === "rate_limited") throw new HttpError(429, "Too many requests. Please try again later.");
  if (outcome === "busy") throw new HttpError(503, "Requests are closed for today. Please try again tomorrow.");
  if (outcome === "created") {
    const mail = adminEmail(env, {
      id: result.id,
      fullName: input.name,
      email: input.email,
      reason: input.reason,
      createdAt: result.created_at,
    });
    // Saved already; the email goes out after the visitor gets their answer.
    ctx.waitUntil(
      sendEmail(env, { to: env.ADMIN_EMAIL, ...mail, idempotencyKey: `cv-request-${result.id}` }).catch((err) =>
        console.error("admin notification:", err.message),
      ),
    );
  }
  // "duplicate" gets the same answer, so the form can't be used to learn who has asked.
  return json(req, env, { ok: true });
}

async function sendAccessEmail(env, request, token) {
  const mail = approvalEmail(env, request, token);
  try {
    await sendEmail(env, {
      to: request.email,
      ...mail,
      replyTo: env.REPLY_TO || undefined,
      idempotencyKey: `cv-access-${request.id}-${(await sha256(token)).slice(0, 16)}`,
    });
    await rpc(env, "cv_mark_email_sent", { p_id: request.id });
    return true;
  } catch (err) {
    console.error("approval email:", err.message);
    return false;
  }
}

async function decide(req, env, id) {
  const body = await readJson(req);
  const decision = body.decision;
  if (decision !== "approve" && decision !== "reject") throw new HttpError(400, "Choose approve or reject.");

  const token = decision === "approve" ? newToken() : null;
  const result = one(
    await rpc(env, "cv_decide", {
      p_id: id,
      p_decision: decision,
      p_token_hash: token ? await sha256(token) : null,
      p_access_hours: accessHours(env),
    }),
  );
  if (!result || result.outcome === "not_found") throw new HttpError(404, "That request doesn't exist.");
  if (result.outcome !== "decided") return json(req, env, { outcome: result.outcome, request: result.request }, 409);

  let emailSent = null;
  if (decision === "approve") {
    emailSent = await sendAccessEmail(env, result.request, token);
    if (emailSent) result.request.approvalEmailSentAt = new Date().toISOString();
  }
  return json(req, env, { outcome: "decided", request: result.request, emailSent });
}

async function resend(req, env, id) {
  const token = newToken();
  const result = one(
    await rpc(env, "cv_reissue", { p_id: id, p_token_hash: await sha256(token), p_access_hours: accessHours(env) }),
  );
  if (!result || result.outcome === "not_found") throw new HttpError(404, "That request doesn't exist.");
  if (result.outcome !== "reissued") return json(req, env, { outcome: result.outcome, request: result.request }, 409);
  const emailSent = await sendAccessEmail(env, result.request, token);
  if (emailSent) result.request.approvalEmailSentAt = new Date().toISOString();
  return json(req, env, { outcome: "reissued", request: result.request, emailSent });
}

async function revoke(req, env, id) {
  const result = one(await rpc(env, "cv_revoke", { p_id: id }));
  if (!result || result.outcome === "not_found") throw new HttpError(404, "That request doesn't exist.");
  return json(req, env, { outcome: result.outcome, request: result.request }, result.outcome === "revoked" ? 200 : 409);
}

async function listRequests(req, env) {
  const status = new URL(req.url).searchParams.get("status");
  if (status && !["pending", "approved", "rejected"].includes(status)) throw new HttpError(400, "Unknown status.");
  const rows = (await rpc(env, "cv_list", { p_status: status || null })) || [];
  return json(req, env, { requests: rows.map((r) => r.request) });
}

async function getRequest(req, env, id) {
  const row = one(await rpc(env, "cv_get", { p_id: id }));
  if (!row || !row.request) throw new HttpError(404, "That request doesn't exist.");
  return json(req, env, { request: row.request });
}

async function openCv(req, env) {
  const body = await readJson(req);
  if (typeof body.token !== "string" || !TOKEN_RE.test(body.token)) {
    throw new HttpError(403, "This link isn't valid.", { reason: "invalid" });
  }
  const result = one(await rpc(env, "cv_open", { p_token_hash: await sha256(body.token) }));
  const outcome = result && result.outcome;
  if (outcome === "expired") throw new HttpError(410, "This link has expired.", { reason: "expired" });
  if (outcome === "revoked") throw new HttpError(410, "This link is no longer active.", { reason: "revoked" });
  if (outcome !== "ok") throw new HttpError(403, "This link isn't valid.", { reason: "invalid" });

  const file = await fetchCv(env);
  const filename = (env.CV_FILENAME || "Avin-Gaur-CV.pdf").replace(/[^A-Za-z0-9._-]/g, "-");
  return new Response(file.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "X-Access-Expires": new Date(result.expires_at).toISOString(),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...corsHeaders(req, env),
    },
  });
}

/* ------------------------------------------------------------------- router */

const REQUIRED = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "ADMIN_EMAIL",
  "ADMIN_GITHUB_LOGIN",
  "SITE_URL",
];

export default {
  // Daily Cron Trigger: a tiny read so a free Supabase project isn't paused for inactivity.
  async scheduled(_event, env, ctx) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return;
    ctx.waitUntil(rpc(env, "cv_list", { p_status: "pending", p_limit: 1 }).catch((err) => console.error("keep-alive:", err.message)));
  },

  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    try {
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            ...corsHeaders(req, env),
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
          },
        });
      }
      if (url.pathname === "/health") return json(req, env, { ok: true });

      const missing = REQUIRED.filter((k) => !env[k]);
      if (missing.length) {
        console.error("missing settings:", missing.join(", "));
        throw new HttpError(500, "This service isn't set up yet.");
      }
      // Browsers from other sites are turned away (CORS also stops them reading answers).
      const origin = req.headers.get("Origin");
      if (origin && !origins(env).includes(origin)) throw new HttpError(403, "Not allowed.");

      const p = url.pathname.replace(/\/+$/, "") || "/";
      if (p === "/requests" && req.method === "POST") return await submitRequest(req, env, ctx);
      if (p === "/cv" && req.method === "POST") return await openCv(req, env);

      if (p === "/admin/requests" || p.startsWith("/admin/requests/")) {
        await requireAdmin(req, env);
        if (p === "/admin/requests" && req.method === "GET") return await listRequests(req, env);
        const m = p.match(/^\/admin\/requests\/([^/]+)(?:\/(decision|revoke|resend))?$/);
        if (!m || !UUID_RE.test(m[1])) throw new HttpError(404, "That request doesn't exist.");
        const id = m[1].toLowerCase();
        if (!m[2] && req.method === "GET") return await getRequest(req, env, id);
        if (m[2] === "decision" && req.method === "POST") return await decide(req, env, id);
        if (m[2] === "revoke" && req.method === "POST") return await revoke(req, env, id);
        if (m[2] === "resend" && req.method === "POST") return await resend(req, env, id);
        throw new HttpError(405, "Method not allowed.");
      }
      throw new HttpError(404, "Not found.");
    } catch (err) {
      if (err instanceof HttpError) return json(req, env, { error: err.message, ...err.extra }, err.status);
      // Messages are written to carry no personal data or tokens.
      console.error("cv-requests:", err && err.message);
      return json(req, env, { error: "Something went wrong. Please try again." }, 500);
    }
  },
};
