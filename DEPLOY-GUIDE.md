# How to put BriefIQ on the internet (beginner guide)

## What you have
This folder is a **static website** — just files a browser reads directly. No server, no installation, no code to run. That's the easiest kind of website to publish.

## The 5-minute way (recommended): Netlify
1. Go to **netlify.com** and create a free account (use Google or email).
2. Once logged in, go to: **app.netlify.com/drop**
3. Drag the file **BriefIQ-website.zip** (or this whole BriefIQ folder) onto the page.
4. Wait ~30 seconds. Netlify gives you a link like `https://something-random.netlify.app`
5. That link works for anyone, anywhere, on any device. Share it.
6. Optional: in Site settings → "Change site name" to get `https://briefiq.netlify.app` (if free), or connect a domain you buy later.

## Alternative: Vercel
1. Go to **vercel.com**, sign up free.
2. Click **Add New → Project → Deploy without Git** isn't offered anymore for drag-drop, so easier: install nothing and use Netlify above — OR put the folder on GitHub first (see below).

## Alternative: GitHub Pages (free forever, a few more steps)
1. Create a free account at **github.com**.
2. Click **＋ → New repository**, name it `briefiq`, keep it Public, create.
3. Click **uploading an existing file**, drag ALL the files from this folder in, commit.
4. Go to Settings → Pages → Source: "main" branch → Save.
5. Your site appears at `https://YOURNAME.github.io/briefiq/` in a minute or two.

## What to upload
Upload **BriefIQ-website.zip** (it contains this whole folder), or drag the folder itself. The important thing: `index.html` must be at the top level, which it is.

## What WILL work on the live site
- The whole analysis engine (paste a brief → full strategic breakdown) — it runs inside each visitor's browser
- File uploads: PDF, DOCX, TXT — with drag-and-drop and clear error messages
- Saving projects, exports (copy / download), dark & light mode, all 15 market packs, the Agency Room, Manual Mode (copy prompt to ChatGPT etc.)

## What will NOT work (and why)
- **Live AI models (ChatGPT/Claude/Gemini buttons)** — these need secret API keys. On this static site, a visitor can paste their own key in AI Settings, but you should NOT put YOUR key in, because anyone could take it. Making AI work for all visitors safely needs a small server — that's what the `briefiq-next` folder is for, later.
- **User accounts / cloud saving** — each visitor's projects save only in their own browser. Two people won't see each other's projects (which is actually fine for now).
- **Payments** — the pricing page is display-only.

## Is anything a mockup?
No. Everything you can click does what it says, with the two honest exceptions above (live AI needs keys; pricing has no checkout). Uploads, analysis, saving, exporting are all real.

## When you outgrow this
The `briefiq-next` folder is the "grown-up" version (accounts, database, safe AI keys). When you're ready: put it on GitHub, click "Import" on Vercel, and follow its README. Same design, same engine — just with a backend.
