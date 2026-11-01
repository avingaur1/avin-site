# avin.

Personal website of Avin Gaur. Next.js (App Router) + TypeScript + Tailwind CSS, set in Geist.
Hosted on GitHub Pages, with a browser editor at `/admin`.

## Editing from the website (`/admin`)

Open `https://<your-site>/admin/` and sign in.

- **Work**: add, edit, reorder (drag) and delete experiences, with month/year pickers and a Present option.
- **Photos**: upload several photos at once (drag them in, or pick from your phone), add captions and
  descriptions, drag to reorder, remove. A live-style preview shows the gallery as it will appear.
- **Website**: introduction and portrait, campus experiences, Beyond the Resume text and interests,
  contact links and footer.

Changes are kept as a draft on that device until you press **Publish**. Publishing makes one commit
(`content/site.json` plus any new photos in `public/images/`), and the editor shows when the live site
has updated. Photos are resized to at most 2000px, converted to WebP and stripped of location data
in the browser before upload. Removing a photo from the gallery keeps its file, so it can be added back.

Thoughts are not edited here: they come from Medium automatically.

Sign-in setup (one time): see [`admin-auth/SETUP.md`](admin-auth/SETUP.md).
The editor's code is in `editor/` and `app/admin/`. The previous editor (Sveltia CMS) is still
available at `/admin/classic/`, configured in `public/admin/classic/config.yml`.

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
