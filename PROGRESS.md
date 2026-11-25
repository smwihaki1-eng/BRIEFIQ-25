# BriefIQ — PROGRESS

Read this at the start of every session. Update it at the end of every session.

Last updated: 25 November 2026

## Roadmap

| # | Phase | Status |
|---|---|---|
| 1 | Full audit (report only) | **Done** 11 Nov 2026 — see docs/AUDIT-2026-11-11.md |
| 2 | Reliability | **In progress** — fix batch 1 done 15 Nov (below) |
| 3 | Kill templates + Quality Checker | **Mostly done** — leaks fixed and Quality Checker v1 built 15 Nov; needs tuning on real AI answers |
| 4 | Research pipeline | **Improved 16 Nov** — local first, current, dated (built in Oct; never deployed) |
| 5 | Images | **Visual Curator built 16 Nov** — tested with stand-in photos only |
| 6 | Onboarding | Not started |
| 7 | Polish and launch check | Not started |
| 8 | In-app agents (Brief Reader, Researcher, Analyst, Visual Curator, Quality Checker) | **All five in place 16 Nov**, shown as a team on every report |

Founder's instruction, 15 Nov 2026: "start with fixing everything and then add in the agencies".
Read as: fix first, then build the in-app agents (charter section 8). **Confirm "agencies" = agents.**

Earlier work (Oct 2026) built parts of phases 2–4 locally: free brain `/api/brain`, honest busy screen
with reason codes, two-pass AI reports, `/api/scrape`, the research pipeline. **Nothing is deployed:**
the live site is still the old build.

## What's done

- 11 Nov 2026 — Full audit. No code changed.
- 15 Nov 2026 — Fix batch 1 (six commits, all local, nothing deployed):
  1. **Git set up.** History lives outside iCloud at `~/.briefiq-git/briefiq-live.git` (a `.git`
     pointer file sits in this folder). Baseline snapshot `2eb6a0f`. Roll back any fix with `git revert <id>`.
  2. **Eight server functions no longer crash on load** (`6b01403`): `_shared`, `waitlist`, `checkout`,
     `stripe-webhook`, `beta-admin`, `beta-projects`, `beta-signup`, `beta-status` → ES modules.
     Tested: old copy throws `require is not defined`; each new one answers a fake request with clean JSON.
  3. **Cron cost hole closed** (`fd72e67`): `isCron()` now requires `CRON_SECRET`. Tested with five
     fake requests. `.env.example` rebuilt from what `/api` really reads.
  4. **No silent fallback on a failed own key** (`9e3dd3b`): the brief is not passed to the free AI
     unless the user presses "Use BriefIQ's free AI" on the new "Your AI key didn't answer" screen
     (Reason: own-key). A failed paid tier still hands over, but says so on screen.
     Tested in the browser at 375px and desktop with a stubbed failing key: zero calls to `/api/brain`
     without consent; one call after consent.
  5. **Export PDF no longer prints hidden template sections** (`30df146`). Tested: 19 AI/research
     sections in the PDF; the engine sections and "Brief quality" header are gone.
  6. Version bumps on both pages + service worker v249 (`83ff909`).
- 15 Nov 2026 — Fix batch 2, the template problem (three commits, local only):
  1. **Exports** (`serialize`/`serializeAI`, `deckAI`, `js/exporter.js`): Copy summary, .txt, deck outline,
     saved-project text, deliverable presets, the 11-slide deck, CSV, the share file and "Save analysis"
     now contain only what the AI wrote. Production Deck and Creator Brief say they are not part of an
     AI report yet.
  2. **Refine the Brief** in an AI report adds the change to the brief and has the AI rewrite the whole
     report, after a confirm (it counts as a report). It no longer swaps in engine sections.
  3. **Reopened projects** no longer show an engine "re-analysis". The brief goes back into the form, a
     saved AI report is shown as saved, and "Write a fresh report" runs a new one.
  4. **Strict merge**: no engine tensions, no invented "Mid"/60% ratings, no canned weaknesses on AI ideas.
  - Tested in the browser with a hand-written answer in the AI's format (no AI keys on this Mac):
    0 engine markers in the text exports; all 8 presets, 11 slides and the CSV hold only the AI's text;
    Refine asks first and sends the change once; reopen shows the saved report, no engine sections;
    the reopen card fits 375px. **Not tested with a real AI answer.**
  - `npm test` passes (45 assertions). No new JavaScript errors in the console on index.html or app.html.
  - **Not tested:** a full real AI report end to end (no AI keys on this machine); real phones;
    anything on Vercel.

- 15 Nov 2026 — Fix batch 3, medium template leaks (two commits, local only):
  1. **A guessed scope never deletes AI-written sections** (`applyKeep`). The scope picker now says it is
     a quick guess, and shows no fixed per-market text.
  2. "Campaigns to study" is matched to the AI's own lead idea and territory (dropped if nothing matches).
  3. Match reasons no longer claim "like the route recommended here"; card label is "Matched to this brief on".
  4. Insight Evidence: no reference rather than a default one; "Related work" not "Proven by"; stale note replaced.
  5. AI-report intros for Insights, Territories, Ideas and Best 3 describe what is actually there.
  6. Playground labels a door's general question as general when the AI did not write one.
  7. PDF and exports drop the formula "why it fits" line an AI report already hides on screen.
  - Tested in the browser with a stand-in AI answer; `npm test` passes. **Not tested with a real AI answer.**

- 15 Nov 2026 — **Quality Checker v1** (`js/quality-checker.js`, wired into `pass()` in `js/ai-enhance.js`):
  - Judges every AI answer before it is shown, in the browser, with **no extra AI call**.
  - Checks: generic sections (could fit another brand), the banned stock phrases, numbers with no source,
    two ideas that are the same idea.
  - Fails → the AI is asked to rewrite **once**, told exactly what failed. Still clearly generic → honest
    screen "The AI's answer wasn't specific enough to your brief" (Reason: generic), nothing shown.
    Smaller findings → the report is shown with a "Quality check — worth a second look" note in the banner.
  - A short brief is never hard-failed for "generic" (nothing to judge against); the banner says so.
  - If the check itself crashes, the banner says the check did not run. Scores are logged to the console
    (`[BriefIQ quality]`) for tuning. Thresholds are in `T` at the top of the file; local-texture words in `TEXTURE`.
  - Tests: `tests/quality-checker.test.mjs` (14 tests: the judge alone + the real `AIEnhance.run()`).
    Browser: generic twice → honest screen; generic then good → "nothing flagged after one rewrite";
    unsourced number twice → shown with the note; clean → "nothing flagged".
  - **Not tuned on real AI answers** (none available on this Mac). Expect to adjust thresholds after the first real runs.
  - Not covered: it cannot verify that a named campaign is real, and it does not judge the Playground or Clarify chat.

- 15 Nov 2026 — **Score strip above AI reports** (`fillTeaser`, js/site-runtime.js; index.html):
  the third tile now shows the AI's verdict ("THE VERDICT — BriefIQ's read") instead of the engine's
  "Solution diagnosis". It says "Being written…" while the AI writes and "Not written yet" if it fails.
  The score and red-flag tiles stay (founder decision). The tiles are hidden until a real analysis fills
  them — the page's built-in sample tiles ("7 red flags", "Rebrand › Campaign") can no longer show as if
  they were about the user's brief — and hidden above a reopened project.
  Tested in the browser: 3 columns on desktop, 1 column at 375px, no side scroll.

- 16 Nov 2026 — **The agent team** (two commits, local only):
  - **Visual Curator** (new `js/visual-curator.js`): one photo for up to 5 insights, 3 territories and 2 ideas,
    searched with a phrase the AI writes for that point (new `img` field in the report schema). No phrase or a
    vague stock phrase → no image. Unsplash + Pexels via `/api/photos`, then Openverse. Local first, no repeats,
    credit + link + alt text, Case Board Save, loads near the screen, broken files replaced or removed.
    Max 10 photo searches per report, remembered 30 minutes.
  - **Researcher**: sources ordered market → region → global; recent pages first for market searches;
    publish dates shown (with an "over two years old" warning) and given to the AI; the AI is told today's date.
  - **Team panel** at the top of every AI report: what each of the five agents did, or why it could not.
  - Tests: 12 new (`tests/visual-curator.test.mjs`); 50 tests in 4 files pass.
  - Browser: full "Run analysis" flow with a stand-in AI and stand-in search → sources ordered and dated correctly,
    team panel correct. Image flow with stand-in photos → 6 of 7 placed, broken file replaced, local photo chosen,
    no repeats, missing one reported; 375px fits.
  - **Not tested with real photo sources**: `/api/photos` needs the Unsplash/Pexels keys (not on this Mac), and
    Openverse was rate-limiting this Mac (HTTP 429). **Not tested with a real AI** — the AI has never been asked
    for `img` phrases outside a stand-in.

- 25 Nov 2026 — **First deploy attempt (Vercel Drop) failed**: "No more than 12 Serverless Functions … on the Hobby plan".
  BriefIQ had 18. Fix: the 17 handlers moved to `api/_fn-<name>.js`; one router `api/[route].js` serves `/api/<name>`
  for all of them (same addresses, per-route time limits kept, clean JSON on timeout or crash); `api/stripe-webhook.js`
  stays separate. Vercel now counts **2 functions**. Tested: all 24 route checks answer clean JSON through the local
  server; the page still finds `/api/brain`; 7 new tests (`tests/api-router.test.mjs`), 57 in total pass.
  New zip: `briefiq-live-deploy-2026-11-25b.zip`. Note: the Drop created a NEW Vercel project
  (`briefiq-live-deploy-2026-11-25`) with no keys — not the live `briefiq-live` project.

## What's broken (still — full detail in the audit)

1. **The live site is still the old build.** Nothing above reaches visitors until it is deployed.
2. **The Supabase project is gone** — its address no longer exists (DNS NXDOMAIN, checked 15 Nov).
   Sign-in, the 3-free-reports count, the research library and shared caps cannot work without a new one.
3. Invite-only beta gate blocks strangers (confirmed in the browser 15 Nov).
4. Template leftovers: the landing demo is engine output on a sample brief (labelled); the scope picker
   (app.html) still lists engine sections an AI report does not show; the other "Learn From The Best"
   groups are fixed library lists, the same for every brief. No Quality Checker yet.
5. 3 free reports is not enforced server-side; the on-screen counter says 5 and is browser-only.
6. 20 simultaneous analyses would mostly hit the paced daily cap; fallback providers can't fit a report.
7. On phones the floating "Feedback" and "Explore your brief" buttons cover content and the
   "Run analysis" bar (seen at 375px on 15 Nov).
8. No Quality Checker; no per-insight images; no Magazine view or calendar export; no analytics.
9. Paid ticket replay, non-atomic counters, og-image has no platform blocklist, no robots.txt check,
   no redirect re-check in the scrapers (audit §6).

## What's next (proposed order)

1. Sylvia: answer the deploy question and create a new Supabase project (decisions 1–2).
2. ~~Fix batch 2 — templates in exports, Refine, reopened projects~~ done. Medium leaks and Quality Checker v1 done too.
3. Fix batch 3 — reliability: client timeouts, the daily-cap pacing, one free-brain chain, refresh
   mid-analysis, enforce free reports server-side (needs Supabase).
4. Fix batch 4 — scraping safety and the remaining cost holes.
5. Deploy to a Vercel preview, run the stranger test with a separate test agent.
6. Then the in-app agents.

## Decisions needed from Sylvia

1. **How is the live site deployed today** (GitHub repo? Vercel upload?). Neither the Vercel nor the
   GitHub command-line tool is installed on this Mac.
2. **Supabase: create a new project** (the old one is gone). Then run the SQL in `supabase/` and `docs/`.
3. **Set on Vercel:** `CRON_SECRET` (the daily research cron is refused until it is set),
   `GEMINI_FREE_API_KEY`, `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `GROQ_API_KEY`, `ADMIN_TOKEN`,
   `AI_TICKET_SECRET`, `ALLOWED_ORIGINS`, `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`, `JINA_API_KEY`.
   Full list in `.env.example`.
4. Beta gate: keep invite-only for now, or open it so the "stranger test" can pass?
5. Free reports: 3 (new rules) or 5 (what the app shows today)?
6. Regional order: the new rules say Kenya → East Africa → Africa → Global; on 13 Oct 2026 this was
   changed to "global benchmark first, then fit to the local market". Which stands?
7. Brand: switch to Makenfy / Ouma Latin VF and the spec palette now (Ouma font file needed), or in phase 7?
8. Magazine view, Timeline view and calendar export are on the checklist but don't exist — build
   them, or take them off the checklist?
9. Should the new rules (Part A) be merged into CLAUDE.md?
10. "Add in the agencies" — the in-app agents (section 8), or something for agency customers?

## Decisions made

- 16 Nov 2026 — Regional order: research still searches both local and global work, but local is shown, ranked
  and handed to the AI first (follows the November charter over the 13 Oct "global benchmark first" decision).
- 16 Nov 2026 — Images: Unsplash, Pexels and Openverse now. Pinterest stays a link-out until Sylvia has API
  access; Are.na not started.
- 15 Nov 2026 — Score strip: keep the score and red flags; swap the diagnosis tile for the AI's verdict (Sylvia).
- 15 Nov 2026 — Quality Checker: a short brief is never rejected as generic; unsourced numbers that survive the
  one rewrite are shown with a note rather than blocking the report. Thresholds: reject under 40% specific
  sections, rewrite under 65%. To be tuned on real AI answers.
- 11 Nov 2026 — Session goal line was blank; started at roadmap phase 1 (full audit).
- 15 Nov 2026 — Git history kept outside iCloud (iCloud sync can corrupt a `.git` folder).
- 15 Nov 2026 — Refine in an AI report rewrites the whole report (counts as one report, asks first) rather
  than patching sections. Reversible: `git revert` the "exports, Refine and reopened projects" commit.
- 15 Nov 2026 — A failed own key asks before using the free AI (the app promises the brief goes
  "straight from your browser to your AI provider"); a failed paid tier hands over with a visible notice.
  Reversible: `git revert 9e3dd3b`.
