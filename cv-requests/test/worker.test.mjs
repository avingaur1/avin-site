// End-to-end tests for the CV Worker.
// The database is real Postgres (PGlite) running supabase/001_cv_requests.sql unchanged;
// Resend, GitHub, Turnstile and Supabase Storage are stand-ins.
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import worker, { validateRequest, adminEmail, approvalEmail } from "../worker.js";

const SITE = "https://avingaur.com";
const ADMIN_KEY = "gho_adminAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const OTHER_KEY = "gho_otherBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const PDF = new TextEncoder().encode("%PDF-1.7 fake cv");

const baseEnv = {
  SUPABASE_URL: "https://db.test",
  SUPABASE_SERVICE_KEY: "sb_secret_test",
  RESEND_API_KEY: "re_test",
  MAIL_FROM: "Avin Gaur <cv@mail.avingaur.com>",
  ADMIN_EMAIL: "owner@example.com",
  ADMIN_GITHUB_LOGIN: "avingaur1",
  IP_HASH_SALT: "salt",
  SITE_URL: SITE,
  ALLOWED_ORIGINS: "https://avingaur.com,https://www.avingaur.com",
};

let db;
let env;
let sent; // emails Resend "sent"
let resendFails;
let cvMissing;
let ipCounter = 0;

before(async () => {
  db = new PGlite();
  // Roles Supabase has that a bare Postgres doesn't.
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;`);
  await db.exec(await readFile(new URL("../supabase/001_cv_requests.sql", import.meta.url), "utf8"));

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const body = init.body;

    if (url.origin === "https://db.test" && url.pathname.startsWith("/rest/v1/rpc/")) {
      assert.equal(init.headers.apikey, "sb_secret_test");
      const fn = url.pathname.split("/").pop();
      assert.match(fn, /^cv_[a-z_]+$/);
      const args = JSON.parse(body);
      const keys = Object.keys(args);
      const sql = `select * from public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")})`;
      const res = await db.query(sql, keys.map((k) => args[k]));
      if (fn === "cv_mark_email_sent") return new Response(null, { status: 204 });
      return Response.json(JSON.parse(JSON.stringify(res.rows)));
    }
    if (url.origin === "https://db.test" && url.pathname === "/storage/v1/object/authenticated/private-cv/cv.pdf") {
      if (cvMissing) return new Response("{}", { status: 400 });
      return new Response(PDF, { headers: { "Content-Type": "application/pdf" } });
    }
    if (url.href === "https://api.resend.com/emails") {
      if (resendFails) return new Response("{}", { status: 500 });
      sent.push(JSON.parse(body));
      return Response.json({ id: "email_" + sent.length });
    }
    if (url.href === "https://api.github.com/user") {
      const auth = init.headers.Authorization;
      if (auth.startsWith("Bearer gho_admin")) return Response.json({ login: "avingaur1", id: 162006013 });
      if (auth === `Bearer ${OTHER_KEY}`) return Response.json({ login: "someone-else", id: 5 });
      return new Response("{}", { status: 401 });
    }
    if (url.href === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
      return Response.json({ success: body.get("response") === "turnstile-ok" });
    }
    throw new Error(`unexpected fetch ${url.href}`);
  };
});

beforeEach(async () => {
  await db.exec("truncate public.cv_requests");
  env = { ...baseEnv };
  sent = [];
  resendFails = false;
  cvMissing = false;
});

async function call(method, path, { body, token, origin = SITE, ip } = {}) {
  const headers = { "CF-Connecting-IP": ip || `203.0.113.${++ipCounter % 250}` };
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const waits = [];
  const res = await worker.fetch(
    new Request(`https://cv.worker.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
    env,
    { waitUntil: (p) => waits.push(p) },
  );
  await Promise.all(waits);
  return res;
}

const submit = (b, opts) => call("POST", "/requests", { body: { name: "Riya Sharma", email: "riya@example.com", ...b }, ...opts });
const pendingId = async () => (await db.query("select id from cv_requests where status='pending' limit 1")).rows[0]?.id;
const tokenFrom = (mail) => mail.text.match(/#t=([A-Za-z0-9_-]{43})/)[1];

/* ------------------------------------------------------------------ submit */

test("valid request is saved as pending and Avin gets an email", async () => {
  const res = await submit({ reason: "Hiring for an analyst role\n\n\n\nThanks" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), SITE);

  const { rows } = await db.query("select * from cv_requests");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].full_name, "Riya Sharma");
  assert.equal(rows[0].reason, "Hiring for an analyst role\n\nThanks");
  assert.equal(rows[0].decided_at, null);
  assert.equal(rows[0].access_token_hash, null);
  assert.match(rows[0].ip_hash, /^[0-9a-f]{32}$/);

  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ["owner@example.com"]);
  assert.equal(sent[0].subject, "New CV Access Request — Riya Sharma");
  assert.ok(sent[0].html.includes(`${SITE}/admin/cv-requests/?id=${rows[0].id}&amp;action=approve`));
  assert.ok(sent[0].html.includes("action=reject"));
  assert.ok(sent[0].text.includes("Requested On:"));
});

test("reason is optional", async () => {
  assert.equal((await submit({})).status, 200);
  assert.equal((await db.query("select reason from cv_requests")).rows[0].reason, null);
  assert.ok(sent[0].text.includes("Reason: Not provided"));
});

test("invalid input gives a useful error and saves nothing", async () => {
  for (const [b, field] of [
    [{ name: "" }, "name"],
    [{ name: "   " }, "name"],
    [{ name: "x".repeat(101) }, "name"],
    [{ name: "http://spam.example" }, "name"],
    [{ email: "" }, "email"],
    [{ email: "not-an-email" }, "email"],
    [{ email: "a@b" }, "email"],
    [{ email: "a..b@example.com" }, "email"],
    [{ reason: "x".repeat(1001) }, "reason"],
  ]) {
    const res = await submit(b);
    assert.equal(res.status, 400, JSON.stringify(b));
    const out = await res.json();
    assert.equal(out.field, field);
    assert.ok(out.error.length > 5);
  }
  assert.equal((await db.query("select count(*)::int n from cv_requests")).rows[0].n, 0);
  assert.equal(sent.length, 0);
});

test("non-JSON and oversized bodies are refused", async () => {
  const res = await worker.fetch(
    new Request("https://cv.worker.test/requests", { method: "POST", headers: { Origin: SITE, "Content-Type": "text/plain" }, body: "name=x" }),
    env,
    { waitUntil() {} },
  );
  assert.equal(res.status, 415);
  assert.equal((await submit({ reason: "x".repeat(9000) })).status, 413);
});

test("HTML in user text is escaped in the email", async () => {
  await submit({ name: "<b>Eve</b>", reason: `<img src=x onerror=alert(1)> "quoted"` });
  assert.ok(!sent[0].html.includes("<img src=x"));
  assert.ok(sent[0].html.includes("&lt;img src=x onerror=alert(1)&gt; &quot;quoted&quot;"));
  assert.ok(sent[0].html.includes("&lt;b&gt;Eve&lt;/b&gt;"));
});

test("names can't inject email headers", async () => {
  await submit({ name: "Eve\r\nBcc: x@evil.test" });
  assert.equal(sent[0].subject, "New CV Access Request — Eve Bcc: x@evil.test");
});

test("duplicate pending request: one row, same public answer, no second email (even at the same moment)", async () => {
  const [a, b] = await Promise.all([submit({}), submit({ email: "RIYA@example.com" })]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.deepEqual(await b.json(), { ok: true });
  assert.equal((await db.query("select count(*)::int n from cv_requests")).rows[0].n, 1);
  assert.equal(sent.length, 1);
});

test("the database itself refuses a second pending row for an email", async () => {
  await submit({});
  await assert.rejects(db.query("insert into cv_requests (full_name, email) values ('X', 'Riya@Example.com')"), /unique/);
});

test("rate limits: per IP per hour, and per email per week", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await submit({ email: `p${i}@example.com` }, { ip: "198.51.100.7" })).status, 200);
  const blocked = await submit({ email: "p9@example.com" }, { ip: "198.51.100.7" });
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).error, /Too many/);

  await db.exec("truncate cv_requests");
  for (let i = 0; i < 3; i++) {
    await submit({ email: "same@example.com" });
    await db.exec("update cv_requests set status='rejected', decided_at=now() where status='pending'");
  }
  assert.equal((await submit({ email: "same@example.com" })).status, 429);
});

test("honeypot submissions are silently dropped", async () => {
  const res = await submit({ website: "http://bot.example" });
  assert.equal(res.status, 200);
  assert.equal((await db.query("select count(*)::int n from cv_requests")).rows[0].n, 0);
  assert.equal(sent.length, 0);
});

test("Turnstile is enforced when configured", async () => {
  env.TURNSTILE_SECRET_KEY = "ts_secret";
  assert.equal((await submit({})).status, 400);
  assert.equal((await submit({ turnstileToken: "wrong" })).status, 400);
  assert.equal((await submit({ turnstileToken: "turnstile-ok" })).status, 200);
});

test("other websites are turned away; CORS only for approved origins", async () => {
  const res = await submit({}, { origin: "https://evil.example" });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
  const pre = await call("OPTIONS", "/requests", { origin: "https://evil.example" });
  assert.equal(pre.headers.get("Access-Control-Allow-Origin"), null);
  const ok = await call("OPTIONS", "/requests", { origin: "https://www.avingaur.com" });
  assert.equal(ok.headers.get("Access-Control-Allow-Origin"), "https://www.avingaur.com");
});

test("an admin email failure doesn't lose the request", async () => {
  resendFails = true;
  assert.equal((await submit({})).status, 200);
  assert.equal((await db.query("select count(*)::int n from cv_requests")).rows[0].n, 1);
});

/* ------------------------------------------------------------------- admin */

test("admin endpoints need Avin's GitHub sign-in", async () => {
  await submit({});
  const id = await pendingId();
  for (const token of [undefined, "short", "gho_unknownCCCCCCCCCCCCCCCCCCCCCCCCCC"]) {
    const r = await call("POST", `/admin/requests/${id}/decision`, { body: { decision: "approve" }, token });
    assert.equal(r.status, 401);
  }
  const other = await call("POST", `/admin/requests/${id}/decision`, { body: { decision: "approve" }, token: OTHER_KEY });
  assert.equal(other.status, 403);
  assert.equal((await call("GET", `/admin/requests/${id}`, { token: OTHER_KEY })).status, 403);
  assert.equal((await call("GET", `/admin/requests`, { token: OTHER_KEY })).status, 403);
  assert.equal((await db.query("select status from cv_requests")).rows[0].status, "pending");
});

test("ADMIN_GITHUB_ID must match when set", async () => {
  await submit({});
  env.ADMIN_GITHUB_ID = "999";
  // A fresh key so the earlier positive check isn't reused from cache.
  const key = "gho_adminIdCheckDDDDDDDDDDDDDDDDDDDDD";
  const r = await call("GET", `/admin/requests/${await pendingId()}`, { token: key });
  assert.equal(r.status, 403); // right login, wrong numeric id
  env.ADMIN_GITHUB_ID = "162006013";
  const ok = await call("GET", `/admin/requests/${await pendingId()}`, { token: "gho_adminIdCheckEEEEEEEEEEEEEEEEEEEEE" });
  assert.equal(ok.status, 200);
});

test("admin can read one request and the list; no hashes are ever returned", async () => {
  await submit({ reason: "Why not" });
  const id = await pendingId();
  const one = await (await call("GET", `/admin/requests/${id}`, { token: ADMIN_KEY })).json();
  assert.equal(one.request.fullName, "Riya Sharma");
  assert.equal(one.request.reason, "Why not");
  assert.equal(one.request.status, "pending");
  const list = await (await call("GET", `/admin/requests?status=pending`, { token: ADMIN_KEY })).json();
  assert.equal(list.requests.length, 1);
  const all = JSON.stringify([one, list]);
  assert.ok(!/hash/i.test(all));
  assert.equal((await call("GET", `/admin/requests/not-a-uuid`, { token: ADMIN_KEY })).status, 404);
  assert.equal((await call("GET", `/admin/requests/00000000-0000-0000-0000-000000000000`, { token: ADMIN_KEY })).status, 404);
});

test("GET never changes anything (safe for email scanners)", async () => {
  await submit({});
  const id = await pendingId();
  assert.equal((await call("GET", `/admin/requests/${id}/decision`, { token: ADMIN_KEY })).status, 405);
  assert.equal((await call("GET", `/admin/requests/${id}?action=approve`, { token: ADMIN_KEY })).status, 200);
  assert.equal((await db.query("select status from cv_requests")).rows[0].status, "pending");
});

/* ------------------------------------------------------- approve and access */

async function approve() {
  await submit({});
  const id = await pendingId();
  sent = [];
  const res = await call("POST", `/admin/requests/${id}/decision`, { body: { decision: "approve" }, token: ADMIN_KEY });
  return { id, res, out: await res.json() };
}

test("approval stores only a token hash, expires in 24h, and emails the requester", async () => {
  const { out } = await approve();
  assert.equal(out.outcome, "decided");
  assert.equal(out.emailSent, true);
  assert.equal(out.request.status, "approved");

  const row = (await db.query("select * from cv_requests")).rows[0];
  assert.match(row.access_token_hash, /^[0-9a-f]{64}$/);
  assert.ok(row.decided_at);
  assert.ok(row.approval_email_sent_at);
  const hours = (row.access_expires_at - row.decided_at) / 3600e3;
  assert.ok(Math.abs(hours - 24) < 0.01, `expires after ${hours}h`);

  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ["riya@example.com"]);
  assert.equal(sent[0].subject, "Your CV Access Request Has Been Approved");
  assert.ok(sent[0].text.startsWith("Hi Riya,"));
  assert.ok(sent[0].html.includes("This link will remain active for 24 hours."));
  const token = tokenFrom(sent[0]);
  assert.ok(sent[0].text.includes(`${SITE}/cv/#t=${token}`));
  assert.notEqual(row.access_token_hash, token);
  assert.ok(!JSON.stringify(out).includes(token), "token not returned to the admin page");
});

test("approved link opens the PDF with private, no-store headers", async () => {
  await approve();
  const token = tokenFrom(sent[0]);
  const res = await call("POST", "/cv", { body: { token } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "application/pdf");
  assert.match(res.headers.get("Cache-Control"), /no-store/);
  assert.match(res.headers.get("Cache-Control"), /private/);
  assert.match(res.headers.get("X-Robots-Tag"), /noindex/);
  assert.ok(Date.parse(res.headers.get("X-Access-Expires")) > Date.now());
  assert.equal(res.headers.get("Access-Control-Expose-Headers"), "X-Access-Expires");
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), PDF);
  assert.equal((await db.query("select access_count from cv_requests")).rows[0].access_count, 1);
});

test("unapproved, guessed or malformed tokens get nothing", async () => {
  await submit({});
  for (const token of [undefined, "", "abc", "A".repeat(43), "x".repeat(43)]) {
    const res = await call("POST", "/cv", { body: { token } });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).reason, "invalid");
  }
});

test("expired access fails", async () => {
  await approve();
  const token = tokenFrom(sent[0]);
  await db.exec("update cv_requests set access_expires_at = now() - interval '1 second'");
  const res = await call("POST", "/cv", { body: { token } });
  assert.equal(res.status, 410);
  assert.equal((await res.json()).reason, "expired");
});

test("revoked access fails, and revoking twice is handled", async () => {
  const { id } = await approve();
  const token = tokenFrom(sent[0]);
  const r1 = await call("POST", `/admin/requests/${id}/revoke`, { token: ADMIN_KEY });
  assert.equal(r1.status, 200);
  assert.ok((await r1.json()).request.accessRevokedAt);
  const res = await call("POST", "/cv", { body: { token } });
  assert.equal(res.status, 410);
  assert.equal((await res.json()).reason, "revoked");
  assert.equal((await call("POST", `/admin/requests/${id}/revoke`, { token: ADMIN_KEY })).status, 409);
});

test("rejection records the decision, makes no link and sends nothing", async () => {
  await submit({});
  const id = await pendingId();
  sent = [];
  const res = await call("POST", `/admin/requests/${id}/decision`, { body: { decision: "reject" }, token: ADMIN_KEY });
  assert.equal(res.status, 200);
  const row = (await db.query("select * from cv_requests")).rows[0];
  assert.equal(row.status, "rejected");
  assert.ok(row.decided_at);
  assert.equal(row.access_token_hash, null);
  assert.equal(row.access_expires_at, null);
  assert.equal(sent.length, 0);
  assert.equal((await call("POST", `/admin/requests/${id}/revoke`, { token: ADMIN_KEY })).status, 409);
});

test("repeated and conflicting decisions: only the first wins", async () => {
  await submit({});
  const id = await pendingId();
  sent = [];
  const [a, b, c] = await Promise.all([
    call("POST", `/admin/requests/${id}/decision`, { body: { decision: "approve" }, token: ADMIN_KEY }),
    call("POST", `/admin/requests/${id}/decision`, { body: { decision: "reject" }, token: ADMIN_KEY }),
    call("POST", `/admin/requests/${id}/decision`, { body: { decision: "approve" }, token: ADMIN_KEY }),
  ]);
  const statuses = [a.status, b.status, c.status].sort();
  assert.deepEqual(statuses, [200, 409, 409]);
  const losers = await Promise.all([a, b, c].filter((r) => r.status === 409).map((r) => r.json()));
  for (const l of losers) assert.equal(l.outcome, "already_decided");
  assert.ok(sent.length <= 1);
  assert.equal(sent.length === 1, (await db.query("select status from cv_requests")).rows[0].status === "approved");
});

test("a request left pending for over 30 days can't be decided", async () => {
  await submit({});
  const id = await pendingId();
  await db.exec("update cv_requests set created_at = now() - interval '31 days'");
  const res = await call("POST", `/admin/requests/${id}/decision`, { body: { decision: "approve" }, token: ADMIN_KEY });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).outcome, "expired");
});

test("if the approval email fails, Avin can send a fresh link; the old one stops working", async () => {
  await submit({});
  const id = await pendingId();
  resendFails = true;
  const out = await (await call("POST", `/admin/requests/${id}/decision`, { body: { decision: "approve" }, token: ADMIN_KEY })).json();
  assert.equal(out.emailSent, false);
  assert.equal(out.request.approvalEmailSentAt, null);

  resendFails = false;
  sent = [];
  const first = await (await call("POST", `/admin/requests/${id}/resend`, { token: ADMIN_KEY })).json();
  assert.equal(first.emailSent, true);
  const t1 = tokenFrom(sent[0]);
  await call("POST", `/admin/requests/${id}/resend`, { token: ADMIN_KEY });
  const t2 = tokenFrom(sent[1]);
  assert.notEqual(t1, t2);
  assert.equal((await call("POST", "/cv", { body: { token: t1 } })).status, 403);
  assert.equal((await call("POST", "/cv", { body: { token: t2 } })).status, 200);
});

test("missing CV file gives a clear 503, not a leak", async () => {
  await approve();
  cvMissing = true;
  const res = await call("POST", "/cv", { body: { token: tokenFrom(sent[0]) } });
  assert.equal(res.status, 503);
});

test("missing settings: service says it isn't set up (no details)", async () => {
  delete env.RESEND_API_KEY;
  const res = await submit({});
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, "This service isn't set up yet.");
});

/* --------------------------------------------------- database permissions */

test("public Supabase roles can't touch the table or functions", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(db.query("select * from public.cv_requests"), /permission denied/);
      await assert.rejects(db.query("insert into public.cv_requests (full_name, email) values ('a','a@b.co')"), /permission denied/);
      await assert.rejects(db.query("select * from public.cv_open('x')"), /permission denied/);
      await assert.rejects(db.query("select * from public.cv_list()"), /permission denied/);
      await assert.rejects(
        db.query("select * from public.cv_decide('00000000-0000-0000-0000-000000000000','approve','h')"),
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  }
  const rls = await db.query("select relrowsecurity from pg_class where relname='cv_requests'");
  assert.equal(rls.rows[0].relrowsecurity, true);
});

test("migration can be run twice", async () => {
  await db.exec(await readFile(new URL("../supabase/001_cv_requests.sql", import.meta.url), "utf8"));
});

/* ------------------------------------------------------------- unit bits */

test("validateRequest trims and normalises", () => {
  const v = validateRequest({ name: "  Riya​   Sharma ", email: " Riya@Example.COM ", reason: "  " });
  assert.deepEqual(v, { name: "Riya Sharma", email: "riya@example.com", reason: null });
});

test("email templates render (written to test/out for a visual check)", async () => {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const dir = new URL("./out/", import.meta.url);
  await mkdir(dir, { recursive: true });
  const r = {
    id: "3f2b8c1e-1111-4a2b-9c3d-123456789abc",
    fullName: "Riya Sharma",
    email: "riya@example.com",
    reason: "I'm hiring for a strategy analyst role at Acme and would love to see your experience in more detail.",
    createdAt: "2026-11-22T19:34:00Z",
  };
  const a = adminEmail(baseEnv, r);
  const b = approvalEmail(baseEnv, r, "x".repeat(43));
  assert.match(a.text, /Requested On: 23 Nov 2026, 1:04 am IST/i);
  await writeFile(new URL("admin-email.html", dir), a.html);
  await writeFile(new URL("approval-email.html", dir), b.html);
});

test("daily keep-alive touches the database", async () => {
  const waits = [];
  await worker.scheduled({}, env, { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  assert.equal(waits.length, 1);
});
