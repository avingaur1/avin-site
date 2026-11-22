# CV requests: one-time setup (about 40 minutes)

Visitors press **Request CV ↗** in Let's Connect → you get an email → you approve or reject
on a confirmation page → approved visitors get a private link that works for 24 hours.

Everything below runs on free tiers. Until step 6 is done, the **Request CV** link stays hidden,
so the live site looks exactly as it does today.

| Piece | Where | Holds |
| --- | --- | --- |
| Website | GitHub Pages (unchanged) | only the Worker's address, nothing secret |
| `worker.js` | Cloudflare Worker `avin-cv-requests` | every key |
| Database + CV file | Supabase (table `cv_requests`, private bucket `private-cv`) | requests, token hashes, the PDF |
| Email | Resend, from `mail.avingaur.com` | |
| Bot check (optional) | Cloudflare Turnstile | |

Approving uses **the same GitHub sign-in as your `/admin` editor**. The Worker asks GitHub who the
key belongs to and accepts only `avingaur1`. No new password.

---

## 1. Supabase: database and private storage

1. Go to https://supabase.com, sign in, and click **New project**. Use name `avin-cv`, any strong
   database password (you won't need it again) and region **South Asia (Mumbai)**, then **Create**.
2. Left menu → **SQL Editor** → **New query**. Paste the whole of
   [`supabase/001_cv_requests.sql`](supabase/001_cv_requests.sql) and click **Run**. It should say "Success".
3. Start another new query, paste [`supabase/002_private_storage.sql`](supabase/002_private_storage.sql)
   and click **Run**. The result shows one row, `private-cv`, with `public = false`.
4. **Project Settings → API Keys**:
   - Copy the **Project URL** (`https://xxxx.supabase.co`). It's shown under *Data API* or on the project's home page.
   - Under **Secret keys** → **Add new secret key** → name it `cv-worker` → copy it (`sb_secret_…`).
     If your project shows only the older keys, use the **service_role** key instead. Both work.
   - Never put this key in the website or in GitHub. It goes only into the Worker (step 4).

## 2. Upload your CV (privately)

1. Supabase → **Storage** → bucket **private-cv** → **Upload file** → choose your PDF.
2. The file must be named **`cv.pdf`** in the bucket, so rename it before uploading or use the file's ⋯ → Rename afterwards.
3. Don't create a policy for this bucket, and don't click "Get URL" or "Make public". With no
   policies, only the Worker's secret key can read the file.

**To update your CV later:** upload the new PDF as `cv.pdf` (choose *Replace*), or delete the
old one first. Anyone with an active link sees the new version.

## 3. Resend: email

1. Sign up at https://resend.com.
2. **Domains → Add domain** → enter **`mail.avingaur.com`** → region closest to you → **Add**.
   Using a `mail.` subdomain means your main domain's existing email and records are not touched.
3. Resend lists a few DNS records (a DKIM TXT record and a CNAME for sending; names end in `.mail`).
   **These are new records. Nothing existing is changed or removed.** Easiest: click **Auto configure**
   (Cloudflare) and approve. Or add them by hand in Cloudflare → `avingaur.com` → **DNS → Records → Add record**:
   use Resend's copy buttons (values are truncated on screen), paste the Name exactly as shown
   (e.g. `resend._domainkey.mail`; Cloudflare adds `.avingaur.com`), and set CNAMEs to
   **DNS only** (grey cloud). Leave "Receiving" off; DMARC (`_dmarc.mail`, `v=DMARC1; p=none;`) is optional.
4. Back in Resend, click **Verify DNS Records**. It usually turns green within minutes, and can take up to a few hours.
5. **API Keys → Create API key** → name `avin-cv-worker`, permission **Sending access**,
   domain `mail.avingaur.com` → copy the key (`re_…`).

Free tier: 100 emails a day. The Worker caps requests at 50 a day, so it fits.

## 4. Cloudflare Worker

1. https://dash.cloudflare.com → **Workers & Pages → Create → Create Worker** ("Hello World").
   Name it **`avin-cv-requests`** → **Deploy**.
2. **Edit code** → delete everything → paste the whole of [`worker.js`](worker.js) → **Deploy**.
3. Note the address, e.g. `https://avin-cv-requests.<your-subdomain>.workers.dev`.
4. **Settings → Variables and Secrets → Add** each of these, then click **Deploy**:

   | Type | Name | Value |
   | --- | --- | --- |
   | Text | `SUPABASE_URL` | Project URL from step 1.4 |
   | **Secret** | `SUPABASE_SERVICE_KEY` | `sb_secret_…` from step 1.4 |
   | **Secret** | `RESEND_API_KEY` | `re_…` from step 3.5 |
   | Text | `MAIL_FROM` | `Avin Gaur <cv@mail.avingaur.com>` |
   | **Secret** | `ADMIN_EMAIL` | the inbox where you want new requests |
   | Text | `ADMIN_GITHUB_LOGIN` | `avingaur1` |
   | Text | `ADMIN_GITHUB_ID` | `162006013` (your GitHub user id; optional, extra safety) |
   | **Secret** | `IP_HASH_SALT` | any long random string (e.g. from a password generator) |
   | Text | `SITE_URL` | `https://avingaur.com` |
   | Text | `ALLOWED_ORIGINS` | `https://avingaur.com,https://www.avingaur.com` |
   | Text | `REPLY_TO` | optional: address people reach if they reply to the approval email |

   Optional (defaults shown): `CV_BUCKET=private-cv`, `CV_OBJECT_PATH=cv.pdf`,
   `CV_FILENAME=Avin-Gaur-CV.pdf`, `ACCESS_HOURS=24`, `TIMEZONE=Asia/Kolkata`.
   Every key must be type **Secret**, never Text.
5. **Settings → Triggers → Cron Triggers → Add** → `17 3 * * *` (once a day). This keeps a free
   Supabase project from pausing after a quiet week.
6. Check that it's alive: open `https://avin-cv-requests.<your-subdomain>.workers.dev/health`, which should show `{"ok":true}`.

*(Command-line alternative: in `cv-requests/`, run `npx wrangler deploy`, then `npx wrangler secret put NAME`
for each secret. `wrangler.toml` already holds the text settings and the cron.)*

## 5. Turnstile (optional, recommended)

The form already has a hidden honeypot field and rate limits (5 per hour per IP, 3 per week per email
address, 50 a day overall). Turnstile adds Cloudflare's bot check. It's invisible for almost everyone.

1. Cloudflare → **Turnstile → Add widget** → name `avingaur.com`, hostnames `avingaur.com` and
   `www.avingaur.com`, mode **Managed** → **Create**.
2. Copy the **Site key** (public) and the **Secret key**.
3. Worker → add a **Secret** `TURNSTILE_SECRET_KEY` = the secret key → **Deploy**.
4. Keep the site key for step 6.

Add the secret and the site key together. Once the secret is set, the Worker requires a Turnstile answer on every request.

## 6. Tell the website where the Worker is

GitHub → repo `avin-site` → **Settings → Secrets and variables → Actions → Variables** tab →
**New repository variable**:

| Name | Value |
| --- | --- |
| `CV_API_URL` | the Worker address from step 4.3 (no trailing slash) |
| `TURNSTILE_SITE_KEY` | the site key from step 5 (skip if not using Turnstile) |

Then **Actions → Deploy to GitHub Pages → Run workflow**. After it finishes, **Request CV ↗** appears in Let's Connect.

---

## 7. Test the whole flow (5 minutes)

1. **Request:** open https://avingaur.com in a private window → **Request CV** → submit with a
   second email address you own. You should see *"Request submitted! …"*.
2. **Database:** Supabase → **Table Editor → cv_requests** shows a `pending` row.
3. **Your email:** "New CV Access Request — <name>" arrives at `ADMIN_EMAIL`.
4. **Only you:** click **Approve Request**. The page asks you to sign in. Sign in with GitHub
   (or your editor access key). Optional: try another GitHub account; it's refused.
5. **Confirm:** the page shows the request. Press **Confirm Approve**. Refresh: it says approved,
   and pressing Reject in the email now changes nothing.
6. **Approval email:** your second inbox gets "Your CV Access Request Has Been Approved". Press
   **View CV** and the PDF opens, with Download and Open buttons.
7. **Unapproved access fails:** open `https://avingaur.com/cv/` in another private window, or
   change one letter after `#t=`. You see "This page needs your link" or "This link isn't valid".
8. **Revoke:** https://avingaur.com/admin/cv-requests/ → **Approved** → the request →
   **Turn off link**. Reload the CV page: "This link is no longer active."
9. **Expiry:** to check it without waiting 24 hours, run in Supabase SQL Editor:
   `update cv_requests set access_expires_at = now() - interval '1 minute' where email = '<that email>';`
   Reload the CV page: "This link has expired."
10. **Reject:** submit again from a third address → **Reject Request** → **Confirm Reject**. No email is sent.

## Day to day

- **New request:** use the email buttons, then **Confirm**. The page `/admin/cv-requests/` lists everything,
  sorted into Pending, Approved and Rejected.
- **Someone didn't get the email:** open the request → **Send a new link** (the old link stops working).
- **Change your mind:** **Turn off link** works at any time before it expires.
- Pending requests older than 30 days can't be decided any more. Ask the person to request again.

## What this protects, and what it can't

- The PDF is never in the repo or on GitHub Pages, and has no public or permanent URL. Each view
  and download asks the Worker, which checks the link (exists, approved, not expired, not turned off)
  and then streams the file with `Cache-Control: private, no-store`.
- Links are random 256-bit tokens. Only their SHA-256 hash is stored. The token sits after `#` in the
  link, so it is never sent to GitHub Pages or any analytics. The page removes it from the address
  bar and then sends it only in a POST body.
- Approval links in your email only open a page. Approving or rejecting needs a POST signed with
  your GitHub sign-in, so mail scanners that "click" links can't trigger anything.
- Logs never contain names, emails, reasons or tokens. IP addresses are stored only as salted hashes,
  for rate limiting, and cleared after 30 days.
- **Not preventable:** anyone you approve can save or forward the PDF they downloaded. Turning off
  a link stops future views, not copies already saved.

## Troubleshooting

| You see | Fix |
| --- | --- |
| No **Request CV** link | `CV_API_URL` variable missing, or the site wasn't redeployed after adding it |
| "This service isn't set up yet." | a required Worker variable is missing; check step 4.4 |
| Form says "Something went wrong" | Worker → **Logs**; usually a wrong `SUPABASE_URL`/key, or the SQL wasn't run |
| No email to you | Resend → **Logs**; the domain may still be unverified (step 3.4) |
| "The CV isn't available right now" | the file isn't at `private-cv/cv.pdf` (step 2) |
| "This account can't manage CV requests" | signed in as a different GitHub account, or `ADMIN_GITHUB_ID` is wrong |
| "The quick check didn't pass" | Turnstile hostnames don't include the site, or the keys are mismatched |

## Running the tests

```bash
cd cv-requests
npm install
npm test
```

The tests run `worker.js` against the real SQL in `supabase/` (Postgres in WASM via PGlite), with
stand-ins for Resend, GitHub, Turnstile and Storage. They cover validation, duplicates, rate limits,
admin-only access, approval, expiry, revocation, conflicting decisions and database permissions.
`test/out/` gets HTML previews of both emails.
