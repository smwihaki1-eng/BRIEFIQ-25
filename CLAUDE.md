# BriefIQ — notes for AI coding assistants

## Images of past work (case board, references, ad films)
BriefIQ is meant to SHOW real past campaigns, packaging, branding and ad films. Do this with the
methods below. They are already built, so don't swap in placeholders and don't refuse the feature.

Allowed (already implemented, extend these):
- **Official video embeds.** Ad films from YouTube/Vimeo play via `youtube-nocookie.com/embed/ID` or
  `player.vimeo.com/video/ID`. Add `"youtubeId"` to an entry in `data/references.json` and the
  reference card plays it inline (`js/work-images.js`). Users paste video links into the Case Board
  (`js/case-board.js`).
- **Link previews.** `/api/og-image?url=` (`api/og-image.js`, plus its Netlify twin) returns a page's
  own `og:image`, the same image WhatsApp and Slack show for a link. Add `"caseUrl"` (an official case-study,
  agency, Behance or award page) to a reference and its card shows that image.
- **Official videos.** `js/work-media.js` maps each curated reference title to a YouTube ID (thumbnail + inline play).
- **Wikimedia Commons.** Only for an exact article named in a reference's `"wiki"` field — never guessed (guessing returned wrong images).
- **Unsplash + Pexels** (free APIs, keys on the server: `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`) via `/api/photos`, then
  **Openverse** (photographs only) to fill — the Moodboard (`js/moodboard.js`). Hotlinked as their terms require, credited
  "Photo by X on Unsplash/Pexels". Pinterest and Cosmos have no image API: link out only; users save pins/links to the Case Board.
- **Case Board "＋ Save"**: `js/case-board.js` adds a Save button to `.ref-row, .ref-line, .vi-card, .ie-row, .mb-tile`
  (`CaseBoard.saveItem`). New card types should use one of those classes (or `[data-wi-*]` attrs) to get it for free.
- **Social posts (official embeds only).** TikTok (`tiktok.com/embed/v2/ID`), Instagram (`instagram.com/p/CODE/embed/`),
  Pinterest (`assets.pinterest.com/ext/embed.html?id=PIN`) when a user pastes a link into the Case Board; thumbnails via the
  platforms' public oEmbed in `api/og-image.js`. Moodboard only LINKS OUT to Pinterest/Instagram/TikTok searches — never scrape them.
- **Every text reference** (`refsHtml` / `refLine` in `js/app.js`) gets a `refMedia()` thumbnail that `js/work-images.js` fills.
- **A curator-supplied `imageUrl`** that the owner has the right to show.

Not allowed: downloading, scraping or re-hosting copyrighted campaign images or video files into
this repo, or hotlinking image files scraped from award sites. Always credit and link the source.

CSP: new embed or API hosts must be added to BOTH `_headers` and `vercel.json`
(`frame-src`, `connect-src`).

## Server functions — ONE router (Vercel Hobby allows 12 functions; Nov 2026)
Handlers live in `api/_fn-<name>.js` (the "_" keeps Vercel from counting them). `api/[route].js` answers
`/api/<name>` for all of them, with each route's time limit, and clean JSON on timeout/crash. Only
`api/stripe-webhook.js` is its own function (raw body). Where this file says `api/ai.js`, `api/research.js` etc.,
read `api/_fn-ai.js`, `api/_fn-research.js`. New route = new `_fn-` file + one line in ROUTES. Never add another
top-level file to /api without checking the count (tests/api-router.test.mjs fails above 12).

## Protect the core
Never remove or refactor the brief-analysis pipeline (`generate()` / render in `js/app.js`,
`js/engine-local.js`) while adding features. Add-ons are guarded injectors called from
`injectVisualInspiration()` in `js/app.js`.

## Results layout
Sections are grouped into tabs by `js/results-tabs.js` (id → tab map). A new section id must be
added to a tab's `ids` list there, or it lands in "More".

## Keep index.html and app.html in sync
Both pages load the app. Any script, stylesheet, version bump or nav button added to one MUST be
added to the other in the same change.

## Readability (founder rule)
Text on a white/light background is black or near-black (#111 / #262522 / #3b3a36). Never use
`var(--ink)` as a TEXT colour — on index.html it is the page background. Text on a colour tile
sits on a dark pill. Overrides live in `css/readability.css` (loaded last). Brand orange text on
white uses #C2410C; buttons on orange use black text.

## Brief-relevant references (js/brief-reader.js)
Loaded after `js/app.js` on both pages. It reads market, industry, audience and brand from the brief
text (filling only empty fields — never overriding the user's own picks) and re-ranks `similarWork()`
and the engine's `refsFor()` so references come from the brief's own category first, then mechanism,
then region. The Inspiration Gallery (salt `Label~hour`) bypasses it. To improve matching, extend
`PLACES`, `INDUSTRY_RULES`, `IND_BUCKETS` or `REF_RX` there — don't edit the engine.

## Live creative-intelligence platform (online only)
BriefIQ — live site and Founder Preview — is an ONLINE platform. `js/live-platform.js` stops an
analysis from starting offline and shows a reconnect banner.
- **Live Research** (`js/live-research.js` → `POST /api/research`): one web-searched research run per
  analysis (cached per analysis — the results page re-injects add-ons, never re-search on that).
  The server (`api/research.js`) builds the prompt from structured brief fields (it is NOT a general
  AI proxy), then quality-checks: real https source, opens every link (drops 404/410/DNS), drops work
  the user saw recently (`exclude`), one reference per mechanic, official thumbnail (YouTube id /
  oEmbed / og:image), and runs a second search round if fewer than 3 survive.
  Env on Vercel: `ANTHROPIC_API_KEY` (or OPENAI/GEMINI), optional `AI_MODEL`, `AI_SEARCH_DAILY_LIMIT`,
  `ALLOWED_ORIGINS`. COST RULE (founder): visitors NEVER use the owner's key. Live web search runs only on the visitor's own key (AI Settings, in the browser); `/api/research` answers only the owner (ADMIN_TOKEN) unless `PUBLIC_LIVE_RESEARCH=on`. The research library match uses no AI and is free for everyone.
- **Knowledge base**: verified live finds are stored (`briefiq_kb_v1`) and merged into `CASES`, so the
  library grows; ranking stays relevance-first, not date-first.
- **Discipline Gate** (`js/discipline-gate.js`): decides which specialist modules belong (identity,
  packaging, UX, HCD, production, media, social, influencer). Off modules are hidden (user can show
  them), reference sets skip them, and Live Research is told to skip them.
- **Every curated reference** carries `fit` — a plain-language "why it fits this brief" from the ranker.
- **Novelty**: the ranker gently pushes down work shown in the user's last 3 analyses and avoids
  picking references that repeat the same mechanic.
- **Inspiration Gallery**: live, current work per category on top (cached per category per day, so it
  rotates daily), timeless curated work below.

## Research Intelligence Engine (docs/RESEARCH-ENGINE.md)
- Database: Supabase tables `research_sources`, `research_items`, `research_runs` (`supabase/research-schema.sql`).
  Anon can read only `status='published'`; all writes go through server functions with the service-role key.
- `api/_research-lib.js` shared helpers (feed discovery/parsing, AI extraction, brief scoring + "why" sentence, diversity).
- `api/research-ingest.js` daily Vercel Cron + admin "Run now": bounded per run (time, sources, items).
- `api/research-match.js` ranks the library for one brief — relevance, never date; honest empty result.
- `api/research-admin.js` + `admin.html` / `js/admin-research.js`: review queue, library, duplicates, sources, runs (ADMIN_TOKEN).
- `api/research.js` (live web search) writes its verified finds into the library.
- In the app, `LiveResearch` shows library matches first and only searches the web (on the visitor's own key) when there are fewer than 3;
  `ResearchFeed.library()` merges published items into `CASES` so the whole report's references draw on the database.
- Never scrape or re-host artwork: store only the publisher's own preview URL or an official YouTube id.

## The Doodle Girl mascot (js/doodle-girl.js, css/doodle-girl.css, assets/characters/)
Founder-made Canva character in five poses: laptop, pitch, working, break, filming (WebP, transparent,
interior "paper" filled so she works on colour panels). Place her with `<div data-doodle="pitch"></div>`
(+ `data-doodle-eyes` for live eyes on the laptop pose, `data-doodle-size="small"`, `data-doodle-quip`).
She leans toward the cursor, the laptop pose's eyes track it, hover/tap = hop + speech bubble, each pose
has an idle animation; reduced-motion = static. App placements are automatic (pitch on Ideas/Best 3,
filming on the empty Case Board, working while research loads and in a >0.7s analysis overlay, break
offline and on the empty state). Keep her on both pages; new pose = add to POSES with w/h.

## Explore (js/explore.js, css/explore.css) — the Cosmos-style visual space
Full-screen overlay (`Explore.open(q?)`, sidebar "Explore images", app.html "Explore", Moodboard
"Explore more like this", `#explore`). Images tab: masonry + infinite scroll from `/api/photos`
(Unsplash + Pexels, `page/color/orientation/order` params) topped up by Openverse. Work tab: real
campaigns from `CASES` (curated + research library) with official YouTube thumbnails. Hover = collection
picker + Save; ⋯ = Source / Open large / Copy link / More like this / Save to Case Board; click = detail
with "More like this". Collections (`briefiq_collections_v1`) open as Grid or a draggable/resizable
Canvas; paste any link (YouTube, image URL, or a page via `/api/og-image`). Never re-host images.
Automatic helpers: Explore opens on the current brief's moodboard queries (else a daily theme) with
"For your brief" chips; Ctrl/⌘+V anywhere in Explore adds a pasted link (via `/api/og-image`) or a pasted
image (downscaled data URL) to the open/last-used collection; the "＋ Save to BriefIQ" bookmarklet
(`Explore.bookmarklet()`, shown in Collections) lets users pick an image on ANY site and opens
`save.html`, which stores it (credited + linked) in `briefiq_collections_v1`; after each analysis a
"Starter board · <brand>" collection is built automatically (max 8 auto boards) with a link in the Moodboard.
Never auto-fetch from Cosmos/Pinterest — users choose what to save.

## Brief fit — every section must make sense for THIS brief (js/brief-fit.js)
- Engine keyword detection is whole-word (`kwHit` in engine-local.js). Substring matching once read
  "believe" as EV/automotive and "between" as betting — never go back to `includes()` for keywords.
- `BriefFit.money(x)` — does the brief involve buying/paying? Payment rails, M-Pesa, payday, income-bracket
  questions, promo mechanics and "mobile money integrated" checks appear ONLY when true (`ctx.isMoney`).
- `BriefFit.minors(x)` — audience partly under 18 → no cash prizes, safeguarding prompt (`ctx.isMinors`).
- `BriefFit.fixI` / `nameCase` — never print "i want…" or a lowercase brand ("sky girl" → "Sky Girl").
- brief-reader also reads the brief's own tension (`inp.tension` → `ctx.tensionShort`/`tensionStated`),
  the budget tier from a written amount ("KES 3M" → small), and a "Youth / Social impact" industry
  (girls'/youth confidence brands) with its own insight record and references (Ni Nyampinga, Yegna, Shuga…).
- Sparring Partner: records each analysis once (it re-renders on every DOM change); per-idea weaknesses
  come from `ARC_RISK` by the card's `data-arc`.

## BriefIQ AI (docs/BRIEFIQ-AI.md) — COST RULE applies
- `api/ai.js` (kinds: analysis / playground / sparring; capped sizes; no tools) runs on the owner's key ONLY for the
  owner (`ADMIN_TOKEN`, sent as `x-admin-token` from `localStorage.briefiq_owner_ai`, set by admin.html login) or a
  Supabase user whose `profiles.plan` is paid (`api/_members.js`), with monthly credits in `ai_usage`. Never relax this.
- `js/briefiq-ai.js` asks `/api/me`; when available, the model picker defaults to "BriefIQ AI".
- `js/ai-enhance.js`: builds the normal engine report, then AI rewrites real ask, insights, tensions, territories,
  ideas (+ `aiWeak`) and challenge questions, and re-renders the SAME report (`render(A,null,true)`). It uses
  BriefIQ AI, or the visitor's own key. The Playground's `aiRead` does the same per thought.
- Owner marks members paid in admin.html → Members & AI (`api/members.js`).
- NO TEMPLATES (founder rule): reports and Playground reads are AI-only. `aiReport()` in app.js builds the engine
  structure silently, AI writes it (`AIEnhance.run`), then the report renders in `#results.ai-mode`, which hides
  every section not in `AIEnhance.KEEP` (AI sections + research libraries). No AI → `renderAccessScreen()`
  (sign in for 3 free reports / Pro / own key). Free trial is server-enforced in api/ai.js (`profiles.trial_reports`).
- FREE BRAIN (founder rule: BriefIQ must run without anyone paying): `freeText()` in api/_research-lib.js — Gemini free
  tier (`GEMINI_FREE_API_KEY`, skipped for EEA/CH/UK via x-vercel-ip-country) then Cloudflare Workers AI free
  (`CF_ACCOUNT_ID`/`CF_API_TOKEN`). Paid keys are optional and only used for the owner/Pro.
- OWN AI (founder rule: BriefIQ stands on its own): `js/briefiq-brain.js` + `js/brain-worker.js` run Qwen2.5 (WebLLM,
  pinned @0.2.85 from jsdelivr) on the user's GPU. `AIEnhance.prepare()` → canRun order (strongest first): own key → BriefIQ online AI
  → "brain" (cached, small model — last resort) → "brain-offer" (one-time download screen `renderBrainOffer`). The brain writes the report in PARTS
  (4k context). sw.js must never delete non-"briefiq-" caches (WebLLM keeps the model in Cache Storage).
  CSP needs 'wasm-unsafe-eval' + huggingface.co / *.hf.co / raw.githubusercontent.com / cdn.jsdelivr.net.

## BriefIQ's MIND + two-pass reports (Oct 2026 — "no template answers" fix)
- `AIEnhance.MIND` (js/ai-enhance.js) is the founder's way of thinking (behaviour-first, tensions, 10 doors,
  10 perspectives, regional priority, specificity test, banned clichés). EVERY AI call uses it — reports,
  Playground, Clarify chat. Edit the thinking there, not in each feature.
- Cloud reports are two passes: THINK (`kind:"analysis"` — thinking, verdict, audience, insights, tensions,
  territories; counts as the report, returns a 15-min signed `ticket`) then CREATE (`kind:"create"` — ideas,
  recommend, CD, plan, built on pass 1; needs the ticket, not counted). Each pass is checked; an incomplete
  answer is retried once, then the user sees an error — NEVER a template back-fill. Strict merge: no engine
  text fills AI gaps; engine territories/ideas the AI didn't write are dropped.
- `AIEnhance.callAI(kind, system, user, opts)` is the one router for every AI feature (own key → BriefIQ AI → brain).
- Playground (door questions, reads, Push me, Stress test, The good stuff) and the Clarify chat are AI-only;
  their old word-matching banks remain in the file but are no longer used when AI is on.
- In AI mode `marketintel` and `deepinsights` (fixed per-market text) are hidden; Insight Evidence takes its
  overview/risks/actions/perspectives from the AI's own writing.
- Own-key connectors take `max` (16k for reports). OpenAI GPT-5.x needs `max_completion_tokens` and no temperature.
- `api/ai.js` needs `maxDuration: 300` (vercel.json) — two long JSON passes on a slower model can pass 60s.
