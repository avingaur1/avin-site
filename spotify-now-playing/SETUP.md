# Spotify "Now playing": one-time setup (about 15 minutes)

The card sits in **Beyond the Resume → Music**, above the playlist link. It stays hidden until
step 6 is done, so nothing on the live site changes while you set this up.

How it fits together:

```
avingaur.com (GitHub Pages)  ──every 30–60 s──▶  Cloudflare Worker  ──▶  Spotify Web API
     shows the card                          holds the keys, caches 25 s
```

You'll make three things: a Cloudflare Worker (holds the secrets), a Spotify app (gives the
Worker permission to see what you're playing), and one setting in the repo (tells the website
where the Worker is). No key ever goes into the website's code or into GitHub.

**Before you start:** Spotify only lets *Development Mode* apps work while the app owner has
an active **Spotify Premium** subscription. If Premium lapses, the card just shows
"Not listening right now" until it's back.

---

## 1. Create the Cloudflare Worker

1. Log in at https://dash.cloudflare.com (the same account that runs avingaur.com's DNS is fine).
2. **Workers & Pages → Create → Create Worker** (start from "Hello World").
   Name it `avin-now-playing` → **Deploy**.
3. **Edit code**: delete everything, paste the whole of
   [`spotify-now-playing/worker.js`](./worker.js), then **Deploy**.
4. Note the Worker's address, e.g. `https://avin-now-playing.<your-subdomain>.workers.dev`.
   You'll use it below as **WORKER**.

(Opening WORKER now shows "missing settings". That's expected until step 3.)

## 2. Create the Spotify app

1. Open https://developer.spotify.com/dashboard and log in with **your** Spotify account.
   Accept the developer terms if asked.
2. **Create app** and fill in:
   - **App name:** `avingaur.com now playing`
   - **App description:** `Shows what I'm listening to on my personal website.`
   - **Website:** `https://avingaur.com`
   - **Redirect URI:** `WORKER/callback`
     (e.g. `https://avin-now-playing.<your-subdomain>.workers.dev/callback`) → **Add**.
     It must match exactly, including `https://` and `/callback`.
   - **Which API/SDKs are you planning to use?** tick **Web API** only.
3. Tick the terms checkbox → **Save**.
4. Open the app → **Settings**. Copy the **Client ID**, then click **View client secret** and copy that too.
   Keep them somewhere private for a few minutes. Don't paste them into GitHub, chat or the website.

## 3. Give the Worker its settings

Cloudflare → `avin-now-playing` → **Settings → Variables and Secrets → Add**:

| Type | Name | Value |
| --- | --- | --- |
| Text | `SPOTIFY_CLIENT_ID` | the Client ID from step 2.4 |
| **Secret** | `SPOTIFY_CLIENT_SECRET` | the client secret from step 2.4 |
| Text | `ALLOWED_ORIGINS` | `https://avingaur.com,https://www.avingaur.com` |
| **Secret** | `SETUP_KEY` | any long random phrase you make up, e.g. `violet-otter-91-lantern` (only for step 4) |

**Deploy** after adding them. Secrets must be type *Secret*, never *Text*.

## 4. Connect your Spotify account (gets the refresh token)

1. In your browser, open: `WORKER/login?key=<your SETUP_KEY>`
2. Spotify asks you to let the app **"View your currently playing content"**. That's the only
   permission it requests (`user-read-currently-playing`). It can't control playback, see your
   playlists, or change anything. Click **Agree**.
3. You land on a page saying **Spotify connected** with a long token. It's shown once and isn't stored.
   Copy it.
4. Cloudflare → Worker → **Variables and Secrets**:
   - **Add** a **Secret** named `SPOTIFY_REFRESH_TOKEN` with that token.
   - **Delete** `SETUP_KEY`. This switches off `/login` and `/callback` for good.
   - **Deploy**.

If Spotify shows an error about the user not being registered, open the app in the Spotify
dashboard → **User Management**, add your own name and Spotify email, and try step 4 again.

## 5. Test the Worker

1. Play something on Spotify (phone, desktop or web).
2. Open `WORKER/now-playing`. You should see something like:
   ```json
   {"isPlaying":true,"track":{"name":"…","artists":["…"],"albumArt":"https://i.scdn.co/…","url":"https://open.spotify.com/track/…"}}
   ```
3. Pause, wait about 30 seconds, refresh: `{"isPlaying":false,…}`.

Answers are cached for about 25 seconds, so a change can take that long to show up.

## 6. Tell the website where the Worker is

Repo `avin-site` → **Settings → Secrets and variables → Actions → Variables tab →
New repository variable**:

- **Name:** `SPOTIFY_NOW_PLAYING_URL`
- **Value:** WORKER, without `/now-playing` and without a trailing slash

Then **Actions → Deploy to GitHub Pages → Run workflow** (or publish any change from /admin).
After about two minutes, the card appears under **Beyond the Resume → Music**.

This is a *Variable*, not a *Secret*, on purpose: the Worker's address is public anyway
(visitors' browsers call it). The Spotify keys never leave Cloudflare.

## 7. Check it on the site

- Desktop and phone: open https://avingaur.com/#beyond while music plays. You should see the
  album art, song and artists, with a green dot and **Now playing**. Tapping the card opens the
  track in Spotify.
- Pause: within about a minute it switches to **Not listening right now**, and the card links to
  your playlist.
- Try light and dark mode with the theme toggle.

---

## Trying it on your computer (optional)

1. Add `http://localhost:3000` to `ALLOWED_ORIGINS` in the Worker (comma-separated), deploy.
2. In the repo folder: copy `.env.example` to `.env.local` and set
   `NEXT_PUBLIC_SPOTIFY_NOW_PLAYING_URL=` to WORKER.
3. `npm run dev` and open http://localhost:3000/#beyond.
4. Remove `http://localhost:3000` from `ALLOWED_ORIGINS` again when you're done.

`.env.local` is git-ignored. It only ever holds the Worker address, never a Spotify key.

## Optional extras

- **Shared cache across visitors:** Cloudflare's edge cache only works on your own domain, not on
  `*.workers.dev`. Worker → **Settings → Domains & Routes → Add → Custom domain** →
  `now-playing.avingaur.com`, then use `https://now-playing.avingaur.com` as WORKER in step 6.
  Not required: the Worker already remembers the last answer in memory.
- **Refresh-token safety net:** if Spotify ever issues a new refresh token, the Worker can keep it.
  **Storage & Databases → KV → Create** a namespace, then Worker → **Settings → Bindings → Add →
  KV namespace**, variable name `SPOTIFY_KV`. Without it, things still work; you'd just redo step 4
  if the token ever stops working.

## What the card shows, and when

| Situation | Card |
| --- | --- |
| A song is playing | Album art, song, artists, **Now playing**; links to the track |
| Paused, nothing playing, podcast, ad, or private session | **Not listening right now**; links to your playlist |
| Spotify slow or unreachable | Last known song for up to 5 minutes, then **Not listening right now** |
| Visitor offline | Keeps what's on screen once, then **Not listening right now** |
| No album art | A small music-note placeholder |
| Background tab | Stops checking; catches up when the tab is visible again |

## If something's off

| What you see | Fix |
| --- | --- |
| No card at all on the site | Step 6: check the variable name `SPOTIFY_NOW_PLAYING_URL`, then re-run the deploy workflow. |
| Card always says "Not listening" | Open `WORKER/now-playing`. `"reason":"not connected yet"` → step 4. `"unavailable":true` → check the Worker's **Logs** tab. |
| `INVALID_CLIENT: Invalid redirect URI` | The Redirect URI in the Spotify app must be exactly `WORKER/callback`. |
| `/login` says "Not found" | `SETUP_KEY` isn't set, or the `key=` in the address doesn't match it. |
| Worker log says "token refresh failed (400 invalid_grant)" | The app was disconnected from your Spotify account. Re-add `SETUP_KEY` and repeat step 4. |
| Browser console shows a CORS error | Add the site's exact address (e.g. `https://www.avingaur.com`) to `ALLOWED_ORIGINS`. |

## Safety, in short

- Client secret and refresh token live only in Cloudflare, stored as encrypted secrets.
- The only permission is `user-read-currently-playing`: read-only, no playback control.
- The Worker only answers `GET` requests, only to the origins you list, and returns only the
  song, artists, album art and link, never tokens.
- `/login` works only while `SETUP_KEY` exists, and is tied to your browser with a one-time cookie.
- To cut off access at once: Spotify → Account → **Manage apps** → remove the app, or delete the Worker.
