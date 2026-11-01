# avin.

Personal website of Avin Gaur. Next.js (App Router) + TypeScript + Tailwind CSS, set in Geist.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Editing content

Almost everything lives in **`content/site.ts`**. You shouldn't need to touch any component.

| What | Where in `site.ts` |
| --- | --- |
| Intro lines | `intro` |
| Work entries | `work.entries` — add `href` to make a row clickable (an arrow appears) |
| Campus stories | `campus.entries` — each has `paragraphs` and optional `photos` |
| Beyond the Resume | `beyond.items`, `beyond.photos`, `beyond.interactiveResume` |
| Contact links | `connect.links` — a link with an empty `href` is hidden |
| Site URL for SEO | `url` — set this to your real domain after deploying |

### Adding photos

1. Put the image in `public/images/`, e.g. `public/images/hostel.jpg`.
2. Reference it in `site.ts`:

```ts
photos: [{ src: "/images/hostel.jpg", alt: "Karakoram hostel at night", caption: "Optional caption" }]
```

`beyond.photos` always shows three slots; empty ones show a quiet placeholder frame.
Campus photos only appear once you add them.

### Writing a thought

Articles are Markdown files in `content/thoughts/`. The file name becomes the URL
(`why-i-like-building-things.md` → `/thoughts/why-i-like-building-things`).

```md
---
title: "Why I like building things"
date: "2026-11-15"
draft: false
summary: "One line used for search results and link previews."
---

Write here. Normal Markdown works: **bold**, links, lists, quotes, images.
```

A post is published only when `draft: false` **and** it has a `date`.
Drafts are listed on the homepage as drafts (no link) and never get a page.
When no posts are published, the section shows "Some thoughts are taking shape."

## Deploying (GitHub Pages)

The site is a static export hosted on **GitHub Pages**. `.github/workflows/deploy.yml`
builds and publishes it on every push to `main`.

1. Create a public repo and upload this folder's contents (including `.github/`).
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Each push to `main` deploys. Progress is under the **Actions** tab.
4. Custom domain: **Settings → Pages → Custom domain**, then add the DNS records GitHub lists at your registrar. Tick **Enforce HTTPS** once it's available.
5. Set `url` in `content/site.ts` to your final address.

The workflow handles the base path automatically, so the site works both at
`username.github.io/repo-name` and on a custom domain.

## Notes

- Theme follows the visitor's system setting until they use the toggle; their choice is saved in localStorage. A tiny inline script in `app/layout.tsx` applies it before first paint, so there's no flash.
- Colours are CSS variables in `app/globals.css`.
- `sitemap.xml` and `robots.txt` are generated automatically.
