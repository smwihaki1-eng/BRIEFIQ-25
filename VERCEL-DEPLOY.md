# Deploy BriefIQ to Vercel — the reliable way

This folder (`~/Desktop/briefiq-live`) is the **single source of truth**. It's a
plain static site — no build step, no framework. Everything it needs is inside it.

## Why the last deploy 404'd
The old deploy served `index.html` but returned 404 for every file in `css/` and
`js/`. That means those subfolders never reached Vercel — the classic result of a
drag-and-drop upload that grabbed the wrong folder (there were ~10 copies of the
project on the Desktop) or dropped the subfolders. Fixed by deploying THIS clean
folder, whole.

## Option A — Vercel CLI (most reliable)
```
cd ~/Desktop/briefiq-live
npx vercel --prod
```
- First run: log in, then **link to your existing project** (the one behind
  `briefiq.vercel.app`) so the URL stays the same — or create a new one.
- When asked about build settings, accept the defaults. There is **no build
  command** and the **output directory is `./`** (the current folder). Vercel
  auto-detects "Other / static".
- The CLI uploads this exact folder with all subfolders intact.

## Option B — Drag & drop (vercel.com)
1. Go to vercel.com → your project → **Deployments** (or "Add New… → Project").
2. Drag the **whole `briefiq-live` folder** (not its contents, not a parent
   folder) into the upload area.
3. No build command. Output directory `./`. Deploy.

## After deploying — clear the old broken cache once
The browser may have cached the old 404s. On the live site do a hard reload
(**Cmd-Shift-R**), or open DevTools → Application → Clear storage → Clear site
data. The service worker only caches successful responses, so once the files
load 200 they'll cache correctly.

## Housekeeping (recommended)
Delete the stale duplicate copies on the Desktop so you never deploy the wrong
one again. Keep only `~/Desktop/briefiq-live`. The originals under
`Desktop/BRIEFIQ/Website redesign project2/BriefIQ-redesign/` remain your working
source; re-copy to `briefiq-live` before each deploy, or just work in
`briefiq-live` directly from now on.

## Verify it worked
Open the deployed URL, then DevTools → Console. You should see **no red 404s**.
Network tab: `studio.css`, `landing.css`, `app.js`, `engine-local.js` etc. all
**200**. Paste a brief in the hero box → "Check this brief →" → a score appears.
