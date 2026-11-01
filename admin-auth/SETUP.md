# Editor sign-in: one-time setup (about 15 minutes)

The editor lives at **https://avingaur1.github.io/avin-site/admin/**.

It works straight away with an access key (Option A). For one-click "Sign in with GitHub",
do Option B once. Nothing secret ever goes into the website's code.

---

## Option A: access key (works today)

1. Open https://github.com/settings/personal-access-tokens/new
2. **Token name:** `avin-site editor`. **Expiration:** 90 days (or what you prefer).
3. **Repository access:** *Only select repositories* → `avin-site`.
4. **Permissions → Repository permissions:**
   - **Contents:** Read and write
   - **Actions:** Read-only (lets the editor tell you when the live site has updated)
   - Metadata: Read-only (added automatically)
5. **Generate token**, copy it, open the editor, choose *Use an access key*, paste, Continue.

The key stays in that browser only. When it expires, make a new one the same way.

---

## Option B: "Sign in with GitHub" (recommended)

You'll create three things: a GitHub App (who's allowed to do what), a Cloudflare Worker
(holds the secret), and one setting in the repo (tells the editor where the Worker is).

### 1. Create the GitHub App

1. Open https://github.com/settings/apps/new
2. Fill in:
   - **GitHub App name:** `avin-site editor` (any unique name)
   - **Homepage URL:** `https://avingaur1.github.io/avin-site/`
   - **Callback URL:** leave for now (you'll fill it in step 3)
   - **Expire user authorization tokens:** ✅ ticked (sign-ins last 8 hours)
   - **Request user authorization (OAuth) during installation:** leave unticked
   - **Webhook → Active:** ❌ untick
3. **Repository permissions:**
   - **Contents:** Read and write
   - **Actions:** Read-only
   - Metadata: Read-only (automatic)
   - Everything else: No access
4. **Where can this GitHub App be installed?** *Only on this account.*
5. **Create GitHub App.**
6. On the next page, note the **Client ID** (starts with `Iv`), then click
   **Generate a new client secret** and copy it somewhere safe for a few minutes.
7. Left menu → **Install App** → **Install** → *Only select repositories* → `avin-site` → **Install**.

The app can only touch `avin-site`, and only its files and deploy status.

### 2. Create the Cloudflare Worker (free)

1. Sign up / log in at https://dash.cloudflare.com
2. **Workers & Pages → Create → Create Worker** (start from "Hello World").
   Name it `avin-editor-auth` → **Deploy**.
3. **Edit code**: delete everything, paste the whole of
   [`admin-auth/worker.js`](./worker.js), then **Deploy**.
4. Note the Worker's address, e.g. `https://avin-editor-auth.<your-subdomain>.workers.dev`.
5. Worker → **Settings → Variables and Secrets → Add**:

   | Type | Name | Value |
   | --- | --- | --- |
   | Text | `GITHUB_CLIENT_ID` | the Client ID from step 1.6 |
   | **Secret** | `GITHUB_CLIENT_SECRET` | the client secret from step 1.6 |
   | Text | `ALLOWED_USER` | `avingaur1` |
   | Text | `DASHBOARD_URL` | `https://avingaur1.github.io/avin-site/admin/` |

   **Deploy** after adding them. The secret must be type *Secret*.

### 3. Point GitHub back at the Worker

GitHub → Settings → Developer settings → GitHub Apps → `avin-site editor` → **Edit**:
**Callback URL** = your Worker address + `/callback`
(e.g. `https://avin-editor-auth.<your-subdomain>.workers.dev/callback`) → **Save changes**.

### 4. Tell the website where the Worker is

Repo `avin-site` → **Settings → Secrets and variables → Actions → Variables tab →
New repository variable**:

- **Name:** `ADMIN_AUTH_URL`
- **Value:** your Worker address, without `/callback` and without a trailing slash

Then **Actions → Deploy to GitHub Pages → Run workflow** (or just publish any change).
After about two minutes the editor shows **Sign in with GitHub**.

---

## If you move to your own domain

Update **`DASHBOARD_URL`** in the Worker to `https://<your-domain>/admin/`, and the
**Homepage URL** of the GitHub App. Nothing else changes.

## Safety, in short

- The client secret exists only inside Cloudflare, stored as an encrypted secret.
- Only `avingaur1` gets through; anyone else's sign-in key is revoked on the spot.
- Even then, the key can only change files in `avin-site` and read its deploy status.
- Sign-ins expire after 8 hours and live only in that browser tab.
- To cut off all access at once: GitHub → Settings → Applications → revoke the app,
  or delete the Worker.
