# avin.

Personal website of Avin Gaur. Next.js (App Router) + TypeScript + Tailwind CSS, set in Geist.
Hosted on GitHub Pages, with a browser editor at `/admin`.

## Editing from the website (`/admin`)

Open `https://<your-site>/admin/` and sign in with a GitHub access token.

- **Thoughts**: write, edit and publish posts. Turn **Draft** on to keep a post hidden.
  Images can be added straight into a post.
- **Homepage**: every section's text, the work entries, campus stories and photos,
  the Beyond the Resume photo strip and interests, and your contact links.

Clicking **Save** commits the change to this repo. GitHub Pages rebuilds the site,
and the change is live in about two minutes (watch the **Actions** tab).
Uploaded photos are resized to at most 2000px and converted to WebP automatically.

The editor is configured in `public/admin/config.yml`. If you rename the repo or
change your GitHub username, update `backend.repo` there.

### Access token

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**
→ Generate new token. Repository access: **Only select repositories** → this repo.
Permissions: **Contents → Read and write**. Paste it into the editor's sign-in screen.
The editor keeps it in that browser only. When it expires, generate a new one.

## Editing files directly

| What | Where |
| --- | --- |
| Homepage text, photos, links | `content/site.json` |
| Posts | `content/thoughts/*.md` |
| Photos | `public/images/` (refer to them as `/images/name.jpg`) |
| Colours | `app/globals.css` |
| Layout | `components/` |

A post is published only when `draft: false` **and** it has a `date`:

```md
---
title: "Why I like building things"
date: "2026-11-15"
draft: false
summary: "One line used for search results and link previews."
---

Write here. Normal Markdown works: **bold**, links, lists, quotes, images.
```

Drafts are listed on the homepage as drafts (no link) and never get a page.
When no posts are published, the section shows "Some thoughts are taking shape."

## Deploying (GitHub Pages)

`.github/workflows/deploy.yml` builds and publishes the site on every push to `main`,
including saves from the editor.

1. Create a public repo and upload this folder's contents (including `.github/`).
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Custom domain: **Settings → Pages → Custom domain**, add the DNS records GitHub lists,
   then tick **Enforce HTTPS**. Update **Site address** in the editor (or `url` in `content/site.json`).

The workflow handles the base path automatically, so the site works both at
`username.github.io/repo-name` and on a custom domain.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Notes

- Theme follows the visitor's system setting until they use the toggle; their choice is saved in localStorage. A tiny inline script in `app/layout.tsx` applies it before first paint, so there's no flash.
- `sitemap.xml` and `robots.txt` are generated automatically. `/admin` is excluded from search engines.
